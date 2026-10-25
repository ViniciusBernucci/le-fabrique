import { randomUUID } from "node:crypto";
import type { AccountIntegrationInput } from "@le-fabrique/contracts";
import { executionResultReportSchema, factoryConfigurationSchema } from "@le-fabrique/contracts";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { RedisService } from "../redis.service";
import { ProviderOnboardingService } from "../settings/provider-onboarding.service";
import { ProviderVerificationService } from "../settings/provider-verification.service";
import { createDefaultFactoryConfiguration } from "../settings/settings.defaults";
import type { AccountPrincipal } from "./account.service";
import { accountProject, accountRole } from "./account-access";
import { AccountEmailService } from "./account-email.service";
import { AccountIdentityService } from "./account-identity.service";
import { decryptPrivate, encryptPrivate } from "./account-private";
import { digest, secret } from "./account-security";
import { scopedClient } from "./account-transaction";

@Injectable()
export class AccountDataService {
  constructor(
    @Inject(RedisService) private readonly redis: RedisService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccountEmailService) private readonly email: AccountEmailService,
    @Inject(AccountIdentityService) private readonly identity: AccountIdentityService,
    @Inject(ProviderOnboardingService) private readonly onboarding: ProviderOnboardingService,
  ) {}
  private async manager(tx: Prisma.TransactionClient, p: AccountPrincipal, owner = false) {
    const current = await accountRole(tx, p);
    if (owner ? current.m.role !== "OWNER" : !["OWNER", "ADMIN"].includes(current.m.role))
      throw new ForbiddenException("Operação restrita à gestão da conta.");
    return current;
  }
  private audit(tx: Prisma.TransactionClient, p: AccountPrincipal, action: string) {
    return tx.accountAuditEvent.create({
      data: { organizationId: p.session.organizationId, actorId: p.session.userId, action },
    });
  }
  async settings(
    p: AccountPrincipal,
    input: { expectedVersion: number; retentionDays: number; billing: Prisma.InputJsonValue },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { org } = await this.manager(tx, p, true);
      if (org.version !== input.expectedVersion)
        throw new ConflictException("Os dados mudaram. Recarregue.");
      await tx.accountOrganization.update({
        where: { id: org.id },
        data: {
          retentionDays: input.retentionDays,
          billing: input.billing,
          version: { increment: 1 },
        },
      });
      await tx.accountNotification.deleteMany({
        where: {
          organizationId: org.id,
          createdAt: { lt: new Date(Date.now() - input.retentionDays * 86400000) },
          readAt: { not: null },
        },
      });
      await this.audit(tx, p, "DATA_SETTINGS_UPDATED");
      return { saved: true };
    });
  }
  async notifications(p: AccountPrincipal) {
    return this.prisma.$transaction(async (tx) => {
      const { m, org } = await accountRole(tx, p);
      const projects = ["OWNER", "ADMIN"].includes(m.role)
        ? await tx.project.findMany({ where: { organizationId: org.id }, select: { id: true } })
        : (await tx.accountProjectGrant.findMany({ where: { membershipId: m.id } })).map((g) => ({
            id: g.projectId,
          }));
      return tx.accountNotification.findMany({
        where: {
          userId: p.session.userId,
          organizationId: org.id,
          OR: [{ projectId: null }, { projectId: { in: projects.map((p) => p.id) } }],
          createdAt: { gte: new Date(Date.now() - org.retentionDays * 86400000) },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
      });
    });
  }
  async readNotification(p: AccountPrincipal, id: string) {
    return this.prisma.accountNotification
      .updateMany({
        where: { id, userId: p.session.userId, organizationId: p.session.organizationId },
        data: { readAt: new Date() },
      })
      .then(() => ({ saved: true }));
  }
  async export(p: AccountPrincipal, cursor: string, section: string) {
    return this.prisma.$transaction(async (tx) => {
      const { org, m } = await accountRole(tx, p);
      const manager = ["OWNER", "ADMIN"].includes(m.role);
      const ids = manager
        ? undefined
        : (await tx.accountProjectGrant.findMany({ where: { membershipId: m.id } })).map(
            (g) => g.projectId,
          );
      const projectFilter = { organizationId: org.id, ...(ids ? { id: { in: ids } } : {}) };
      const paging = {
        orderBy: { id: "asc" as const },
        take: 200,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      };
      let rows: unknown[] = [];
      if (section === "profile") {
        const user = await tx.accountUser.findUniqueOrThrow({ where: { id: p.session.userId } });
        rows = [
          {
            id: user.id,
            name: user.name,
            email: user.email,
            preferences: user.preferences,
            avatarDataUrl: user.avatarDataUrl,
            organization: {
              id: org.id,
              name: org.name,
              retentionDays: org.retentionDays,
              ...(m.role === "OWNER" ? { billing: org.billing } : {}),
            },
          },
        ];
      } else if (section === "projects")
        rows = await tx.project.findMany({
          where: projectFilter,
          ...paging,
          include: { definition: true },
        });
      else if (section === "tickets")
        rows = await tx.ticket.findMany({ where: { project: projectFilter }, ...paging });
      else if (section === "runs")
        rows = await tx.run.findMany({ where: { ticket: { project: projectFilter } }, ...paging });
      else if (section === "attempts") {
        const attempts = await tx.attempt.findMany({
          where: { run: { ticket: { project: projectFilter } } },
          ...paging,
          select: {
            id: true,
            runId: true,
            sequence: true,
            status: true,
            startedAt: true,
            completedAt: true,
            stoppedConfirmed: true,
            result: true,
          },
        });
        rows = attempts.map((a) => ({
          ...a,
          result: executionResultReportSchema.safeParse(a.result).success
            ? executionResultReportSchema.parse(a.result)
            : null,
        }));
      } else if (section === "members") {
        if (!manager) throw new ForbiddenException();
        rows = await tx.accountMembership.findMany({
          where: { organizationId: org.id },
          ...paging,
          include: { user: { select: { id: true, name: true, email: true } } },
        });
      } else if (section === "activity") {
        if (!manager) throw new ForbiddenException();
        rows = await tx.accountAuditEvent.findMany({
          where: { organizationId: org.id },
          ...paging,
        });
      } else if (section === "integrations") {
        if (!manager) throw new ForbiddenException();
        rows = await tx.accountIntegration.findMany({
          where: { organizationId: org.id },
          ...paging,
          select: {
            id: true,
            name: true,
            provider: true,
            mode: true,
            configuration: true,
            enabled: true,
            version: true,
            createdAt: true,
          },
        });
      } else throw new NotFoundException("Seção de exportação inválida.");
      return {
        schemaVersion: 1,
        organizationId: org.id,
        observedAt: new Date().toISOString(),
        section,
        rows,
        nextCursor: rows.length === 200 ? (rows.at(-1) as { id: string }).id : null,
      };
    });
  }
  async integrations(p: AccountPrincipal) {
    return this.prisma.$transaction(async (tx) => {
      await this.manager(tx, p);
      const rows = await tx.accountIntegration.findMany({
        where: { organizationId: p.session.organizationId },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const global = await tx.factorySettings.findUnique({ where: { id: "global" } });
      const config = global
        ? factoryConfigurationSchema.parse(global.configuration)
        : createDefaultFactoryConfiguration();
      return Promise.all(
        rows.map(async (i) => ({
          id: i.id,
          name: i.name,
          provider: i.provider,
          mode: i.mode,
          runtimeId: i.runtimeId,
          configuration: i.configuration,
          enabled: i.enabled,
          version: i.version,
          credentialConfigured: !!i.secretEncrypted,
          state:
            config.installations.find((r) => r.id === i.runtimeId)?.state ??
            (i.secretEncrypted ? "REGISTERED" : "UNCONFIGURED"),
          grants: await tx.accountIntegrationGrant.findMany({
            where: { integrationId: i.id },
            select: { projectId: true },
          }),
        })),
      );
    });
  }
  async integration(p: AccountPrincipal, input: AccountIntegrationInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.manager(tx, p);
      if (
        (await tx.accountIntegration.count({
          where: { organizationId: p.session.organizationId },
        })) >= 100
      )
        throw new ConflictException("Limite de integrações atingido.");
      const id = randomUUID();
      const runtimeId = input.mode === "SUBSCRIPTION_CLI" ? `ac-${id}` : null;
      const { secret: credential, ...configuration } = input;
      await tx.accountIntegration.create({
        data: {
          id,
          organizationId: p.session.organizationId,
          name: input.name,
          provider: input.provider,
          mode: input.mode,
          runtimeId,
          configuration,
          secretEncrypted: credential ? encryptPrivate(credential, `integration:${id}`) : null,
        },
      });
      if (runtimeId) {
        await tx.$queryRaw`SELECT id FROM factory_settings WHERE id='global' FOR UPDATE`;
        const settings = await tx.factorySettings.findUnique({ where: { id: "global" } });
        const config = settings
          ? factoryConfigurationSchema.parse(settings.configuration)
          : createDefaultFactoryConfiguration();
        const next = factoryConfigurationSchema.parse({
          ...config,
          installations: [
            ...config.installations,
            {
              id: runtimeId,
              provider: input.provider,
              label: input.name.slice(0, 80),
              executable: {
                CODEX: "codex",
                CLAUDE: "claude",
                ANTIGRAVITY: "antigravity",
                GITHUB: "gh",
              }[input.provider],
              enabled: true,
              state: "AUTH_REQUIRED",
              authMode: "SUBSCRIPTION_CLI",
              models: input.models,
              defaultModel: input.models[0] ?? null,
            },
          ],
        });
        await tx.factorySettings.upsert({
          where: { id: "global" },
          create: { id: "global", configuration: next },
          update: { configuration: next, version: { increment: 1 } },
        });
      }
      await this.audit(tx, p, "INTEGRATION_CREATED");
      return { id };
    });
  }
  async integrationEnabled(p: AccountPrincipal, id: string, enabled: boolean, version: number) {
    return this.prisma.$transaction(async (tx) => {
      await this.manager(tx, p);
      const i = await tx.accountIntegration.findFirst({
        where: { id, organizationId: p.session.organizationId },
      });
      if (!i) throw new NotFoundException("Integração indisponível.");
      if (i.version !== version) throw new ConflictException("Integração alterada.");
      await tx.accountIntegration.update({
        where: { id },
        data: { enabled, version: { increment: 1 } },
      });
      if (i.runtimeId) {
        await tx.$queryRaw`SELECT id FROM factory_settings WHERE id='global' FOR UPDATE`;
        const settings = await tx.factorySettings.findUniqueOrThrow({ where: { id: "global" } });
        const config = factoryConfigurationSchema.parse(settings.configuration);
        const next = factoryConfigurationSchema.parse({
          ...config,
          installations: config.installations.map((r) =>
            r.id === i.runtimeId
              ? { ...r, enabled, state: enabled ? "AUTH_REQUIRED" : "DISABLED" }
              : r,
          ),
        });
        await tx.factorySettings.update({
          where: { id: "global" },
          data: { configuration: next, version: { increment: 1 } },
        });
      }
      await this.audit(tx, p, "INTEGRATION_UPDATED");
      return { saved: true };
    });
  }
  async integrationGrant(p: AccountPrincipal, id: string, projectId: string, enabled: boolean) {
    return this.prisma.$transaction(async (tx) => {
      await accountProject(tx, p, projectId, "MANAGE");
      const i = await tx.accountIntegration.findFirst({
        where: { id, organizationId: p.session.organizationId },
      });
      if (!i) throw new NotFoundException("Integração indisponível.");
      if (enabled)
        await tx.accountIntegrationGrant.upsert({
          where: { integrationId_projectId: { integrationId: id, projectId } },
          create: { integrationId: id, projectId, organizationId: p.session.organizationId },
          update: {},
        });
      else await tx.accountIntegrationGrant.deleteMany({ where: { integrationId: id, projectId } });
      await this.audit(tx, p, "INTEGRATION_GRANT_CHANGED");
      return { saved: true };
    });
  }
  async onboardingRequest(p: AccountPrincipal, id: string, verify = false) {
    return this.prisma.$transaction(async (tx) => {
      await this.manager(tx, p);
      const i = await tx.accountIntegration.findFirst({
        where: { id, organizationId: p.session.organizationId, enabled: true },
      });
      if (i?.provider === "GITHUB" && verify) {
        if (!i.secretEncrypted) throw new ConflictException("Credencial ausente.");
        const response = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `Bearer ${decryptPrivate(i.secretEncrypted, `integration:${i.id}`)}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        });
        if (!response.ok) throw new ConflictException("O GitHub não confirmou esta credencial.");
        const user = (await response.json()) as { login?: unknown };
        if (typeof user.login !== "string")
          throw new ConflictException("Resposta GitHub inválida.");
        await tx.accountIntegration.update({
          where: { id: i.id },
          data: {
            configuration: {
              ...(i.configuration as Prisma.JsonObject),
              githubLogin: user.login,
              verifiedAt: new Date().toISOString(),
            },
            version: { increment: 1 },
          },
        });
        await this.audit(tx, p, "GITHUB_CONNECTION_VERIFIED");
        return { verified: true, login: user.login };
      }
      if (!i?.runtimeId) throw new NotFoundException("Integração CLI indisponível.");
      await this.audit(
        tx,
        p,
        verify ? "PROVIDER_VERIFICATION_REQUESTED" : "PROVIDER_LOGIN_REQUESTED",
      );
      return verify
        ? new ProviderVerificationService(scopedClient(tx)).request(i.runtimeId)
        : new ProviderOnboardingService(scopedClient(tx), this.redis).request(i.runtimeId);
    });
  }
  async onboardingSession(
    p: AccountPrincipal,
    id: string,
    sessionId: string,
    action: "STATE" | "CHALLENGE" | "CODE",
    code?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.manager(tx, p);
      const i = await tx.accountIntegration.findFirst({
        where: { id, organizationId: p.session.organizationId },
      });
      const s = await tx.providerOnboardingSession.findFirst({
        where: { id: sessionId, installationId: i?.runtimeId ?? "unavailable" },
      });
      if (!i || !s || !i.enabled) throw new NotFoundException("Login indisponível.");
      if (s.expiresAt <= new Date() && ["PENDING", "RUNNING", "AWAITING_USER"].includes(s.status)) {
        const expired = await tx.providerOnboardingSession.update({
          where: { id: s.id },
          data: { status: "EXPIRED", completedAt: new Date() },
        });
        if (action !== "STATE") throw new ConflictException("A janela de login expirou.");
        return expired;
      }
      if (action === "CHALLENGE") return this.onboarding.getChallenge(s.id);
      if (action === "CODE") {
        await this.audit(tx, p, "PROVIDER_AUTHORIZATION_SUBMITTED");
        return this.onboarding.submitAuthorizationCode(s.id, code ?? "");
      }
      return { ...s, expiresAt: s.expiresAt.toISOString() };
    });
  }
  async transfer(
    p: AccountPrincipal,
    input: { membershipId: string; password: string; otp?: string; recoveryCode?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.manager(tx, p, true);
      await this.identity.requireSensitive(tx, p, input);
      const member = await tx.accountMembership.findFirst({
        where: {
          id: input.membershipId,
          organizationId: p.session.organizationId,
          status: "ACTIVE",
        },
        include: { user: true },
      });
      if (!member || member.userId === p.session.userId || !member.user.emailVerifiedAt)
        throw new ConflictException("Escolha outro membro com email verificado.");
      await tx.accountOwnershipTransfer.deleteMany({
        where: { organizationId: p.session.organizationId, acceptedAt: null },
      });
      const token = secret();
      await tx.accountOwnershipTransfer.create({
        data: {
          organizationId: p.session.organizationId,
          fromUserId: p.session.userId,
          toUserId: member.userId,
          tokenHash: digest(token),
          expiresAt: new Date(Date.now() + 86400000),
        },
      });
      await this.email.enqueue(
        tx,
        member.user.email,
        "Transferência da conta La fabrique",
        `Aceite a titularidade: ${this.email.publicUrl(`account-transfer=${token}`)}\nVálido por 24 horas.`,
      );
      await this.audit(tx, p, "OWNERSHIP_TRANSFER_REQUESTED");
      return { saved: true };
    });
  }
  async acceptTransfer(
    p: AccountPrincipal,
    input: { token: string; password: string; otp?: string; recoveryCode?: string },
  ) {
    const transfer = await this.prisma.accountOwnershipTransfer.findUnique({
      where: { tokenHash: digest(input.token) },
    });
    if (!transfer || transfer.toUserId !== p.session.userId)
      throw new NotFoundException("Transferência indisponível.");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_organizations WHERE id=${transfer.organizationId}::uuid FOR UPDATE`;
      const current = await tx.accountOwnershipTransfer.findUniqueOrThrow({
        where: { id: transfer.id },
      });
      if (current.acceptedAt || current.expiresAt <= new Date())
        throw new ConflictException("Transferência expirada.");
      await this.identity.requireSensitive(tx, p, input);
      const members = await tx.accountMembership.findMany({
        where: {
          organizationId: current.organizationId,
          userId: { in: [current.fromUserId, current.toUserId] },
          status: "ACTIVE",
        },
      });
      if (
        !members.some((m) => m.userId === current.fromUserId && m.role === "OWNER") ||
        !members.some((m) => m.userId === current.toUserId)
      )
        throw new ConflictException("Titularidade alterada.");
      await tx.accountMembership.update({
        where: {
          organizationId_userId: {
            organizationId: current.organizationId,
            userId: current.fromUserId,
          },
        },
        data: { role: "ADMIN", version: { increment: 1 } },
      });
      await tx.accountMembership.update({
        where: {
          organizationId_userId: {
            organizationId: current.organizationId,
            userId: current.toUserId,
          },
        },
        data: { role: "OWNER", version: { increment: 1 } },
      });
      await tx.accountOwnershipTransfer.update({
        where: { id: current.id },
        data: { acceptedAt: new Date() },
      });
      await tx.accountAuditEvent.create({
        data: {
          organizationId: current.organizationId,
          actorId: p.session.userId,
          action: "OWNERSHIP_TRANSFERRED",
        },
      });
      return { saved: true };
    });
  }
  async archive(
    p: AccountPrincipal,
    input: { password: string; otp?: string; recoveryCode?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const { org } = await this.manager(tx, p, true);
      await this.identity.requireSensitive(tx, p, input);
      if (
        org.stripeSubscriptionId &&
        !["canceled", "incomplete_expired"].includes(org.subscriptionStatus)
      )
        throw new ConflictException("Cancele e reconcilie a assinatura antes de encerrar a conta.");
      if (
        await tx.attempt.count({
          where: {
            stoppedConfirmed: false,
            run: { ticket: { project: { organizationId: org.id } } },
          },
        })
      )
        throw new ConflictException(
          "Há um writer sem término confirmado. Pause e reconcilie antes de encerrar.",
        );
      await tx.accountOrganization.update({
        where: { id: org.id },
        data: { archivedAt: new Date(), version: { increment: 1 } },
      });
      await tx.accountSession.deleteMany({ where: { organizationId: org.id } });
      await tx.accountJobAuthority.updateMany({
        where: { organizationId: org.id },
        data: { revoked: true },
      });
      await this.audit(tx, p, "ACCOUNT_ARCHIVED");
      return { saved: true };
    });
  }
}
