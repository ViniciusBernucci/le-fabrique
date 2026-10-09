import { createHmac, timingSafeEqual } from "node:crypto";
import { type AccountPlan, accountPlanCatalogSchema } from "@le-fabrique/contracts";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import type { AccountPrincipal } from "./account.service";
import { AccountEmailService } from "./account-email.service";
import { scopedClient } from "./account-transaction";

export function planCatalog(): AccountPlan[] {
  const encoded = process.env.ACCOUNT_PLAN_CATALOG;
  if (!encoded) return [];
  try {
    const catalog = accountPlanCatalogSchema.parse(JSON.parse(encoded));
    const ids = catalog.map((p) => p.id);
    const prices = catalog.flatMap((p) => (p.stripePriceId ? [p.stripePriceId] : []));
    if (new Set(ids).size !== ids.length || new Set(prices).size !== prices.length)
      throw new Error("Duplicate plan");
    return catalog;
  } catch {
    throw new ServiceUnavailableException("Catálogo de planos inválido.");
  }
}
export function quota(snapshot: Prisma.JsonValue | null): {
  members: number;
  projects: number;
  storageBytes: number;
} {
  const result = accountPlanCatalogSchema.safeParse(snapshot ? [snapshot] : []);
  return result.success && result.data[0]
    ? result.data[0]
    : { members: 200, projects: 1000, storageBytes: 1073741824 };
}
export function verifyStripeSignature(
  raw: Buffer,
  header: string,
  key: string,
  now = Date.now(),
): void {
  const parts = header.split(",");
  const stamp = parts.find((p) => p.startsWith("t="))?.slice(2);
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!stamp || !/^\d+$/.test(stamp) || Math.abs(now / 1000 - Number(stamp)) > 300)
    throw new BadRequestException("Assinatura de cobrança inválida.");
  const expected = createHmac("sha256", key).update(`${stamp}.`).update(raw).digest();
  if (
    !signatures.some(
      (s) => /^[a-f0-9]{64}$/.test(s) && timingSafeEqual(expected, Buffer.from(s, "hex")),
    )
  )
    throw new BadRequestException("Assinatura de cobrança inválida.");
}
type StripeObject = {
  id: string;
  status?: string;
  url?: string;
  client_reference_id?: string;
  subscription?: string;
  customer?: string;
  metadata?: Record<string, string>;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  items?: { data: { price: { id: string }; current_period_end?: number }[] };
  unit_amount?: number;
  recurring?: { interval: string };
  total?: number;
  amount_paid?: number;
  amount_due?: number;
  currency?: string;
  hosted_invoice_url?: string;
  created?: number;
};
@Injectable()
export class AccountBillingService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccountEmailService) private readonly email: AccountEmailService,
  ) {}
  configured(): boolean {
    return (
      process.env.ACCOUNT_STRIPE_ENABLED === "true" &&
      !!process.env.ACCOUNT_STRIPE_SECRET_KEY &&
      !!process.env.ACCOUNT_STRIPE_WEBHOOK_SECRET
    );
  }
  private async stripe(
    path: string,
    method = "GET",
    body?: URLSearchParams,
    idempotency?: string,
  ): Promise<StripeObject> {
    if (!this.configured())
      throw new ServiceUnavailableException("Cobrança Stripe não configurada.");
    const response = await fetch(`https://api.stripe.com/v1/${path}`, {
      method,
      redirect: "error",
      headers: {
        Authorization: `Bearer ${process.env.ACCOUNT_STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
        ...(idempotency ? { "Idempotency-Key": idempotency } : {}),
      },
      body,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        "A cobrança não confirmou a operação. Reconcile antes de repetir.",
      );
    return response.json() as Promise<StripeObject>;
  }
  private owner(p: AccountPrincipal) {
    if (p.role !== "OWNER")
      throw new ForbiddenException("Somente o proprietário gerencia o plano.");
  }
  async state(p: AccountPrincipal) {
    const org = await this.prisma.accountOrganization.findUniqueOrThrow({
      where: { id: p.session.organizationId },
    });
    const snapshot = accountPlanCatalogSchema.safeParse(org.planSnapshot ? [org.planSnapshot] : []);
    return {
      catalog: planCatalog().map(({ stripePriceId: _private, ...plan }) => plan),
      configured: this.configured(),
      selected: org.planId,
      status: org.subscriptionStatus,
      plan: snapshot.success ? (snapshot.data[0] ?? null) : null,
      cancelAtPeriodEnd: org.cancelAtPeriodEnd,
      currentPeriodEnd: org.currentPeriodEnd?.toISOString() ?? null,
      billing: p.role === "OWNER" ? org.billing : {},
      retentionDays: org.retentionDays,
      version: org.version,
      invoices:
        p.role === "OWNER"
          ? await this.prisma.accountInvoice
              .findMany({
                where: { organizationId: org.id },
                orderBy: { createdAt: "desc" },
                take: 50,
              })
              .then((rows) =>
                rows.map((i) => ({
                  id: i.id,
                  amountMinor: Number(i.amountMinor),
                  currency: i.currency,
                  status: i.status,
                  url: i.hostedUrl,
                  createdAt: i.createdAt.toISOString(),
                })),
              )
          : [],
    };
  }
  async checkout(p: AccountPrincipal, planId: string, requestId: string) {
    this.owner(p);
    const plan = planCatalog().find((item) => item.id === planId);
    if (!plan) throw new BadRequestException("Plano não disponível.");
    const intent = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_organizations WHERE id=${p.session.organizationId}::uuid FOR UPDATE`;
      const org = await tx.accountOrganization.findUniqueOrThrow({
        where: { id: p.session.organizationId },
      });
      const member = await tx.accountMembership.findUnique({
        where: { organizationId_userId: { organizationId: org.id, userId: p.session.userId } },
      });
      if (member?.role !== "OWNER" || member.status !== "ACTIVE")
        throw new ForbiddenException("Titularidade alterada.");
      if (org.archivedAt) throw new ForbiddenException("Conta encerrada.");
      if (
        org.stripeSubscriptionId &&
        !["canceled", "incomplete_expired"].includes(org.subscriptionStatus)
      )
        throw new ConflictException("Use Gerenciar assinatura para trocar ou cancelar seu plano.");
      const members = await tx.accountMembership.count({
        where: { organizationId: org.id, status: "ACTIVE" },
      });
      const pending = await tx.accountInvitation.count({
        where: { organizationId: org.id, status: "PENDING", expiresAt: { gt: new Date() } },
      });
      const projects = await tx.project.count({ where: { organizationId: org.id } });
      const reserved = await tx.accountStorageReservation.aggregate({
        where: { organizationId: org.id },
        _sum: { bytes: true },
      });
      const stored = Number(
        (
          await tx.$queryRaw<
            { bytes: bigint }[]
          >`SELECT COALESCE(sum(octet_length(a.artifact::text)),0)::bigint AS bytes FROM attempts a JOIN runs r ON r.id=a.run_id JOIN tickets t ON t.id=r.ticket_id JOIN projects p ON p.id=t.project_id WHERE p.organization_id=${org.id}::uuid`
        )[0]?.bytes ?? 0n,
      );
      if (
        members + pending > plan.members ||
        projects > plan.projects ||
        stored + Number(reserved._sum.bytes ?? 0n) > plan.storageBytes
      )
        throw new ConflictException("O uso atual excede os limites deste plano.");
      if (plan.priceMinor === 0) {
        if (
          await tx.accountBillingIntent.findFirst({
            where: { organizationId: org.id, status: { in: ["REQUESTED", "CHECKOUT"] } },
          })
        )
          throw new ConflictException("Reconcilie o checkout pendente antes de mudar de plano.");
        await tx.accountOrganization.update({
          where: { id: org.id },
          data: {
            planId: plan.id,
            planSnapshot: plan,
            subscriptionStatus: "FREE",
            version: { increment: 1 },
          },
        });
        return null;
      }
      if (!plan.stripePriceId || !this.configured())
        throw new ServiceUnavailableException("Este plano ainda não tem cobrança configurada.");
      const existing = await tx.accountBillingIntent.findUnique({ where: { id: requestId } });
      if (existing) {
        if (
          existing.organizationId !== org.id ||
          (existing.planSnapshot as { id?: string; version?: number }).id !== plan.id ||
          (existing.planSnapshot as { version?: number }).version !== plan.version
        )
          throw new ConflictException("Solicitação incompatível.");
        return existing;
      }
      if (
        await tx.accountBillingIntent.findFirst({
          where: { organizationId: org.id, status: { in: ["REQUESTED", "CHECKOUT"] } },
        })
      )
        throw new ConflictException(
          "Há uma solicitação de cobrança pendente. Reconcile antes de criar outra.",
        );
      return tx.accountBillingIntent.create({
        data: { id: requestId, organizationId: org.id, planSnapshot: plan },
      });
    });
    if (!intent) return { url: null, selected: true };
    if (Date.now() - intent.createdAt.getTime() > 86400000)
      throw new ConflictException("Solicitação antiga exige reconciliação.");
    if (intent.stripeSessionId) {
      const checkout = await this.stripe(
        `checkout/sessions/${encodeURIComponent(intent.stripeSessionId)}`,
      );
      if (checkout.status !== "open")
        throw new ConflictException("Checkout encerrado. Atualize o plano.");
      return { url: this.checkoutUrl(checkout.url), selected: false };
    }
    const price = await this.stripe(`prices/${encodeURIComponent(plan.stripePriceId ?? "")}`);
    if (
      price.unit_amount !== plan.priceMinor ||
      price.currency?.toUpperCase() !== plan.currency ||
      price.recurring?.interval !== plan.interval
    )
      throw new ConflictException(
        "O preço Stripe difere do catálogo. O operador precisa corrigir a configuração.",
      );
    const body = new URLSearchParams({
      mode: "subscription",
      "line_items[0][price]": plan.stripePriceId ?? "",
      "line_items[0][quantity]": "1",
      client_reference_id: intent.organizationId,
      "metadata[account_intent_id]": intent.id,
      "subscription_data[metadata][account_organization_id]": intent.organizationId,
      success_url: this.email.publicUrl("account-billing=return"),
      cancel_url: this.email.publicUrl("account-billing=cancel"),
    });
    const org = await this.prisma.accountOrganization.findUniqueOrThrow({
      where: { id: intent.organizationId },
    });
    if (org.stripeCustomerId) body.set("customer", org.stripeCustomerId);
    const result = await this.stripe(
      "checkout/sessions",
      "POST",
      body,
      `account-plan-${intent.id}`,
    );
    await this.prisma.accountBillingIntent.update({
      where: { id: intent.id },
      data: { stripeSessionId: result.id, status: "CHECKOUT" },
    });
    return { url: this.checkoutUrl(result.url), selected: false };
  }
  private checkoutUrl(value?: string): string {
    if (!value) throw new ServiceUnavailableException("Checkout indisponível.");
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !["checkout.stripe.com", "billing.stripe.com"].includes(url.hostname)
    )
      throw new ServiceUnavailableException("Destino de cobrança inválido.");
    return url.toString();
  }
  async portal(p: AccountPrincipal) {
    this.owner(p);
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM account_organizations WHERE id=${p.session.organizationId}::uuid FOR UPDATE`;
        const m = await tx.accountMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: p.session.organizationId,
              userId: p.session.userId,
            },
          },
        });
        if (m?.role !== "OWNER" || m.status !== "ACTIVE")
          throw new ForbiddenException("Titularidade alterada.");
        const org = await tx.accountOrganization.findUniqueOrThrow({
          where: { id: p.session.organizationId },
        });
        if (!org.stripeCustomerId || org.archivedAt)
          throw new ConflictException("Nenhuma assinatura para gerenciar.");
        const result = await this.stripe(
          "billing_portal/sessions",
          "POST",
          new URLSearchParams({
            customer: org.stripeCustomerId,
            return_url: this.email.publicUrl("account-billing=return"),
          }),
        );
        return { url: this.checkoutUrl(result.url) };
      },
      { timeout: 25000 },
    );
  }
  async reconcile(p: AccountPrincipal) {
    this.owner(p);
    const pending = await this.prisma.accountBillingIntent.findFirst({
      where: {
        organizationId: p.session.organizationId,
        status: { in: ["REQUESTED", "CHECKOUT"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (pending && !pending.stripeSessionId)
      return this.checkout(p, (pending.planSnapshot as AccountPlan).id, pending.id);
    if (pending?.stripeSessionId) {
      const checkout = await this.stripe(
        `checkout/sessions/${encodeURIComponent(pending.stripeSessionId)}`,
      );
      if (checkout.status === "open") return { url: this.checkoutUrl(checkout.url) };
      if (checkout.status === "expired")
        await this.prisma.accountBillingIntent.update({
          where: { id: pending.id },
          data: { status: "EXPIRED" },
        });
      else if (checkout.status === "complete") await this.syncCheckout(checkout);
    }
    const org = await this.prisma.accountOrganization.findUniqueOrThrow({
      where: { id: p.session.organizationId },
    });
    if (org.stripeSubscriptionId) await this.syncSubscription(org.stripeSubscriptionId, org.id);
    return { saved: true };
  }
  private async syncCheckout(checkout: StripeObject) {
    const intentId = checkout.metadata?.account_intent_id;
    if (!intentId) return;
    const intent = await this.prisma.accountBillingIntent.findUnique({ where: { id: intentId } });
    if (
      !intent ||
      intent.stripeSessionId !== checkout.id ||
      checkout.client_reference_id !== intent.organizationId ||
      !checkout.subscription ||
      !checkout.customer
    )
      return;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_organizations WHERE id=${intent.organizationId}::uuid FOR UPDATE`;
      await tx.accountOrganization.update({
        where: { id: intent.organizationId },
        data: { stripeSubscriptionId: checkout.subscription, stripeCustomerId: checkout.customer },
      });
      await tx.accountBillingIntent.update({
        where: { id: intent.id },
        data: { status: "COMPLETED" },
      });
    });
    await this.syncSubscription(checkout.subscription, intent.organizationId);
  }
  private async syncSubscription(id: string, orgId: string) {
    await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM account_organizations WHERE id=${orgId}::uuid FOR UPDATE`;
        const org = await tx.accountOrganization.findUniqueOrThrow({ where: { id: orgId } });
        if (org.stripeSubscriptionId !== id) return;
        const sub = await this.stripe(`subscriptions/${encodeURIComponent(id)}`);
        if (sub.metadata?.account_organization_id !== orgId) return;
        const proposed = planCatalog().find(
          (p) => p.stripePriceId === sub.items?.data[0]?.price.id,
        );
        const active = ["active", "trialing"].includes(sub.status ?? "");
        await tx.accountOrganization.update({
          where: { id: orgId },
          data: {
            subscriptionStatus: sub.status ?? "unknown",
            cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
            currentPeriodEnd:
              sub.current_period_end || sub.items?.data[0]?.current_period_end
                ? new Date(
                    (sub.current_period_end ?? sub.items?.data[0]?.current_period_end ?? 0) * 1000,
                  )
                : null,
            ...(active && proposed ? { planId: proposed.id, planSnapshot: proposed } : {}),
            version: { increment: 1 },
          },
        });
        await tx.accountAuditEvent.create({
          data: {
            organizationId: orgId,
            actorId: (
              await tx.accountMembership.findFirstOrThrow({
                where: { organizationId: orgId, role: "OWNER" },
              })
            ).userId,
            action: "SUBSCRIPTION_SYNCHRONIZED",
          },
        });
      },
      { timeout: 25000 },
    );
  }
  async webhook(raw: Buffer, signature: string) {
    const key = process.env.ACCOUNT_STRIPE_WEBHOOK_SECRET;
    if (!key || !this.configured())
      throw new ServiceUnavailableException("Webhook não configurado.");
    verifyStripeSignature(raw, signature, key);
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(638941)`;
        return new AccountBillingService(scopedClient(tx), this.email).processWebhook(
          raw,
          signature,
        );
      },
      { timeout: 60000 },
    );
  }
  private async processWebhook(raw: Buffer, signature: string) {
    const key = process.env.ACCOUNT_STRIPE_WEBHOOK_SECRET;
    if (!key || !this.configured())
      throw new ServiceUnavailableException("Webhook não configurado.");
    verifyStripeSignature(raw, signature, key);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new BadRequestException("Evento inválido.");
    }
    if (!parsed || typeof parsed !== "object") throw new BadRequestException("Evento inválido.");
    const event = parsed as {
      id: string;
      type: string;
      data: { object: StripeObject };
    };
    if (
      typeof event.id !== "string" ||
      !/^evt_[a-zA-Z0-9]+$/.test(event.id) ||
      typeof event.type !== "string" ||
      !event.data?.object ||
      typeof event.data.object.id !== "string"
    )
      throw new BadRequestException("Evento inválido.");
    if (await this.prisma.accountBillingEvent.findUnique({ where: { id: event.id } }))
      return { received: true };
    const object = event.data.object;
    if (event.type === "checkout.session.completed") {
      await this.syncCheckout(
        await this.stripe(`checkout/sessions/${encodeURIComponent(object.id)}`),
      );
    } else if (event.type.startsWith("customer.subscription.")) {
      const org = await this.prisma.accountOrganization.findUnique({
        where: { stripeSubscriptionId: object.id },
      });
      if (org) await this.syncSubscription(object.id, org.id);
    } else if (event.type.startsWith("invoice.")) {
      const invoice = await this.stripe(`invoices/${encodeURIComponent(object.id)}`);
      const org = invoice.customer
        ? await this.prisma.accountOrganization.findUnique({
            where: { stripeCustomerId: invoice.customer },
          })
        : null;
      if (org) {
        const url = invoice.hosted_invoice_url ? new URL(invoice.hosted_invoice_url) : null;
        const data = {
          organizationId: org.id,
          amountMinor: BigInt(invoice.total ?? invoice.amount_due ?? invoice.amount_paid ?? 0),
          currency: invoice.currency ?? "unknown",
          status: invoice.status ?? "unknown",
          hostedUrl:
            url?.protocol === "https:" && url.hostname === "invoice.stripe.com"
              ? url.toString()
              : null,
          createdAt: new Date((invoice.created ?? Math.floor(Date.now() / 1000)) * 1000),
        };
        await this.prisma.accountInvoice.upsert({
          where: { id: invoice.id },
          create: { id: invoice.id, ...data },
          update: data,
        });
        if (org.stripeSubscriptionId) await this.syncSubscription(org.stripeSubscriptionId, org.id);
      }
    }
    await this.prisma.accountBillingEvent.upsert({
      where: { id: event.id },
      create: { id: event.id },
      update: {},
    });
    return { received: true };
  }
}
