import type {
  AccountInvite,
  AccountLogin,
  AccountMemberUpdate,
  AccountProfileUpdate,
  AccountRegister,
  AccountRole,
} from "@le-fabrique/contracts";
import { accountPreferencesSchema, accountRoleSchema } from "@le-fabrique/contracts";
import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, type AccountSession as SessionRecord } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { RedisService } from "../redis.service";
import { validateAvatar } from "./account-avatar";
import { quota } from "./account-billing.service";
import { AccountEmailService } from "./account-email.service";
import { secondFactor } from "./account-private";
import {
  assertCanManage,
  assertMemberChange,
  digest,
  hashPassword,
  SESSION_SECONDS,
  secret,
  verifyPassword,
} from "./account-security";
import { accountUsage } from "./account-usage";

type Transaction = Prisma.TransactionClient;
export type AccountPrincipal = { session: SessionRecord; role: AccountRole };
const invalidLogin = () => new UnauthorizedException("Email ou senha inválidos.");
const preferences = {
  locale: "pt-BR",
  timeZone: "Europe/Berlin",
  deliveryNotifications: true,
  executionNotifications: true,
};

@Injectable()
export class AccountService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
    @Optional() @Inject(AccountEmailService) private readonly email?: AccountEmailService,
  ) {}

  async throttle(identity: string): Promise<void> {
    try {
      await this.redis.ensureConnected();
      const key = `account-auth:${digest(identity)}`;
      const count = Number(
        await this.redis.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],600) end; return n",
          1,
          key,
        ),
      );
      if (count > 10) throw new HttpException("Muitas tentativas. Aguarde alguns minutos.", 429);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException("Autenticação temporariamente indisponível.");
    }
  }
  private audit(tx: Transaction, organizationId: string, actorId: string, action: string) {
    return tx.accountAuditEvent.create({ data: { organizationId, actorId, action } });
  }
  private async lock(tx: Transaction, organizationId: string): Promise<void> {
    await tx.$queryRaw`SELECT id FROM account_organizations WHERE id = ${organizationId}::uuid FOR UPDATE`;
  }
  private async role(tx: Transaction, principal: AccountPrincipal): Promise<AccountRole> {
    const membership = await tx.accountMembership.findUnique({
      where: {
        organizationId_userId: {
          organizationId: principal.session.organizationId,
          userId: principal.session.userId,
        },
      },
    });
    if (
      membership?.status !== "ACTIVE" ||
      (await tx.accountOrganization.findUnique({ where: { id: principal.session.organizationId } }))
        ?.archivedAt
    )
      throw new ForbiddenException("Acesso à conta revogado.");
    return accountRoleSchema.parse(membership.role);
  }
  private async createSession(tx: Transaction, userId: string, organizationId: string) {
    // Serialize session issuance per user, also protecting concurrent password changes.
    await tx.$queryRaw`SELECT id FROM account_users WHERE id = ${userId}::uuid FOR UPDATE`;
    await tx.accountSession.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
    const sessions = await tx.accountSession.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (sessions.length >= 20)
      await tx.accountSession.deleteMany({
        where: { id: { in: sessions.slice(19).map((item) => item.id) } },
      });
    const token = secret();
    const session = await tx.accountSession.create({
      data: {
        userId,
        organizationId,
        tokenHash: digest(token),
        csrfToken: secret(),
        expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
      },
    });
    return { token, session };
  }
  async register(input: AccountRegister) {
    const passwordHash = await hashPassword(input.password);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.accountUser.create({
          data: { name: input.name, email: input.email, passwordHash, preferences },
        });
        const organization = await tx.accountOrganization.create({
          data: { name: input.organizationName },
        });
        await tx.accountMembership.create({
          data: { userId: user.id, organizationId: organization.id, role: "OWNER" },
        });
        await this.audit(tx, organization.id, user.id, "ACCOUNT_CREATED");
        return this.createSession(tx, user.id, organization.id);
      });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002")
        throw new ConflictException(
          "Não foi possível cadastrar esta conta. Tente entrar com seus dados.",
        );
      throw error;
    }
  }
  async login(input: AccountLogin) {
    const user = await this.prisma.accountUser.findUnique({ where: { email: input.email } });
    // Perform the same password work for an unknown email, without exposing its existence.
    const dummy = `scrypt-v1:${"0".repeat(32)}:${"0".repeat(128)}`;
    if (!(await verifyPassword(input.password, user?.passwordHash ?? dummy)) || !user)
      throw invalidLogin();
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.accountUser.findUniqueOrThrow({ where: { id: user.id } });
      if (current.passwordHash !== user.passwordHash) throw invalidLogin();
      await secondFactor(tx, current, input);
      const membership = await tx.accountMembership.findFirst({
        where: { userId: user.id, status: "ACTIVE", organization: { archivedAt: null } },
        orderBy: { id: "asc" },
      });
      if (!membership) throw invalidLogin();
      await this.audit(tx, membership.organizationId, user.id, "SIGNED_IN");
      return this.createSession(tx, user.id, membership.organizationId);
    });
  }
  async authenticate(token: string): Promise<AccountPrincipal> {
    const session = await this.prisma.accountSession.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!session || session.expiresAt.getTime() <= Date.now())
      throw new UnauthorizedException("Sessão inválida ou expirada.");
    const membership = await this.prisma.accountMembership.findUnique({
      where: {
        organizationId_userId: { organizationId: session.organizationId, userId: session.userId },
      },
    });
    if (
      membership?.status !== "ACTIVE" ||
      (await this.prisma.accountOrganization.findUnique({ where: { id: session.organizationId } }))
        ?.archivedAt
    )
      throw new ForbiddenException("Acesso à conta revogado.");
    return { session, role: accountRoleSchema.parse(membership.role) };
  }
  async snapshot(principal: AccountPrincipal) {
    const user = await this.prisma.accountUser.findUniqueOrThrow({
      where: { id: principal.session.userId },
    });
    const memberships = await this.prisma.accountMembership.findMany({
      where: { userId: user.id, status: "ACTIVE", organization: { archivedAt: null } },
      include: { organization: true },
      orderBy: { id: "asc" },
      take: 200,
    });
    const organizations = memberships.map((m) => ({
      id: m.organizationId,
      name: m.organization.name,
      version: m.organization.version,
      role: accountRoleSchema.parse(m.role),
    }));
    const organization = organizations.find((item) => item.id === principal.session.organizationId);
    if (!organization) throw new ForbiddenException("Acesso à conta revogado.");
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: !!user.emailVerifiedAt,
        mfaEnabled: !!user.mfaSecret,
        avatarDataUrl: user.avatarDataUrl,
        version: user.version,
        preferences: accountPreferencesSchema.parse(user.preferences),
      },
      organization,
      organizations,
      csrfToken: principal.session.csrfToken,
    };
  }
  async overview(principal: AccountPrincipal) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, principal.session.organizationId);
      const role = await this.role(tx, principal);
      const organizationId = principal.session.organizationId;
      const canManage = ["OWNER", "ADMIN"].includes(role);
      const membership = await tx.accountMembership.findUniqueOrThrow({
        where: { organizationId_userId: { organizationId, userId: principal.session.userId } },
      });
      const visibleIds = canManage
        ? undefined
        : (await tx.accountProjectGrant.findMany({ where: { membershipId: membership.id } })).map(
            (g) => g.projectId,
          );
      const projectWhere = { organizationId, ...(visibleIds ? { id: { in: visibleIds } } : {}) };
      const scopeSql = visibleIds
        ? visibleIds.length
          ? Prisma.sql`AND p.id IN (${Prisma.join(visibleIds.map((id) => Prisma.sql`${id}::uuid`))})`
          : Prisma.sql`AND false`
        : Prisma.sql``;

      const observed = await accountUsage(tx, organizationId, visibleIds);
      const memberships = await tx.accountMembership.findMany({
        where: { organizationId, ...(canManage ? {} : { userId: principal.session.userId }) },
        include: { user: true },
        orderBy: { id: "asc" },
        take: 200,
      });
      const now = new Date();
      const invitations = canManage
        ? await tx.accountInvitation.findMany({
            where: { organizationId },
            orderBy: { expiresAt: "desc" },
            take: 100,
          })
        : [];
      const audit = canManage
        ? await tx.accountAuditEvent.findMany({
            where: { organizationId },
            include: { actor: { select: { name: true } } },
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 50,
          })
        : [];
      return {
        members: memberships.map((m) => ({
          id: m.id,
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          status: m.status,
          version: m.version,
        })),
        invitations: invitations.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          status: i.status === "PENDING" && i.expiresAt <= now ? "EXPIRED" : i.status,
          expiresAt: i.expiresAt.toISOString(),
        })),
        audit: audit.map((a) => ({
          id: a.id,
          actorName: a.actor.name,
          action: a.action,
          createdAt: a.createdAt.toISOString(),
        })),
        usage: {
          activeMembers: await tx.accountMembership.count({
            where: { organizationId, status: "ACTIVE" },
          }),
          pendingInvitations: await tx.accountInvitation.count({
            where: { organizationId, status: "PENDING", expiresAt: { gt: now } },
          }),
          projects: await tx.project.count({ where: projectWhere }),
          executions: await tx.run.count({ where: { ticket: { project: projectWhere } } }),
          storageBytes: Number(
            (
              await tx.$queryRaw<{ bytes: bigint }[]>(
                Prisma.sql`SELECT COALESCE(sum(octet_length(a.artifact::text)),0)::bigint AS bytes FROM attempts a JOIN runs r ON r.id=a.run_id JOIN tickets t ON t.id=r.ticket_id JOIN projects p ON p.id=t.project_id WHERE p.organization_id=${organizationId}::uuid ${scopeSql}`,
              )
            )[0]?.bytes ?? 0n,
          ),
          reservedStorageBytes: Number(
            (
              await tx.$queryRaw<{ bytes: bigint }[]>(
                Prisma.sql`SELECT COALESCE(sum(s.bytes),0)::bigint AS bytes FROM account_storage_reservations s JOIN attempts a ON a.id=s.attempt_id JOIN runs r ON r.id=a.run_id JOIN tickets t ON t.id=r.ticket_id JOIN projects p ON p.id=t.project_id WHERE p.organization_id=${organizationId}::uuid ${scopeSql}`,
              )
            )[0]?.bytes ?? 0n,
          ),
          aiUsage: observed.aiUsage,
          executionSeconds: observed.executionSeconds,
          executionTimeIncomplete: observed.executionTimeIncomplete,
          executionTimeObservedAt: observed.executionTimeObservedAt,
          awaitingApproval: await tx.ticket.count({
            where: { project: projectWhere, status: { in: ["VALIDATING", "AWAITING_HUMAN"] } },
          }),
        },
        plan: await tx.accountOrganization
          .findUniqueOrThrow({ where: { id: organizationId } })
          .then((org) => ({
            status: org.subscriptionStatus,
            name: (org.planSnapshot as { name?: string } | null)?.name ?? null,
            renewsAt: org.currentPeriodEnd?.toISOString() ?? null,
          })),
      };
    });
  }
  async profile(principal: AccountPrincipal, input: AccountProfileUpdate) {
    await this.prisma.$transaction(async (tx) => {
      await this.role(tx, principal);
      validateAvatar(input.avatarDataUrl);
      const updated = await tx.accountUser.updateMany({
        where: { id: principal.session.userId, version: input.expectedVersion },
        data: {
          name: input.name,
          preferences: input.preferences,
          ...(input.avatarDataUrl !== undefined ? { avatarDataUrl: input.avatarDataUrl } : {}),
          version: { increment: 1 },
        },
      });
      if (!updated.count)
        throw new ConflictException("O perfil mudou. Recarregue antes de salvar.");
      await this.audit(
        tx,
        principal.session.organizationId,
        principal.session.userId,
        "PROFILE_UPDATED",
      );
    });
  }
  async organization(
    principal: AccountPrincipal,
    input: { name: string; expectedVersion: number },
  ) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, principal.session.organizationId);
      assertCanManage(await this.role(tx, principal));
      const updated = await tx.accountOrganization.updateMany({
        where: { id: principal.session.organizationId, version: input.expectedVersion },
        data: { name: input.name, version: { increment: 1 } },
      });
      if (!updated.count)
        throw new ConflictException("A organização mudou. Recarregue antes de salvar.");
      await this.audit(
        tx,
        principal.session.organizationId,
        principal.session.userId,
        "ORGANIZATION_UPDATED",
      );
    });
  }
  async switchOrganization(principal: AccountPrincipal, organizationId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, organizationId);
      const membership = await tx.accountMembership.findUnique({
        where: { organizationId_userId: { organizationId, userId: principal.session.userId } },
      });
      if (membership?.status !== "ACTIVE") throw new NotFoundException("Conta não disponível.");
      const updated = await tx.accountSession.updateMany({
        where: { id: principal.session.id, expiresAt: { gt: new Date() } },
        data: { organizationId },
      });
      if (!updated.count) throw new UnauthorizedException("Sessão expirada.");
      await this.audit(tx, organizationId, principal.session.userId, "ACCOUNT_SELECTED");
    });
  }
  async invite(principal: AccountPrincipal, input: AccountInvite) {
    const token = secret();
    const invitation = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, principal.session.organizationId);
      const role = await this.role(tx, principal);
      assertMemberChange(role, "READER", input.role);
      const membership = await tx.accountMembership.findFirst({
        where: { organizationId: principal.session.organizationId, user: { email: input.email } },
      });
      if (membership)
        throw new ConflictException(
          "Este usuário já tem um vínculo. Gerencie o acesso na lista de membros.",
        );
      const count = await tx.accountMembership.count({
        where: { organizationId: principal.session.organizationId, status: "ACTIVE" },
      });
      const pending = await tx.accountInvitation.count({
        where: {
          organizationId: principal.session.organizationId,
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
      });
      const org = await tx.accountOrganization.findUniqueOrThrow({
        where: { id: principal.session.organizationId },
      });
      if (count + pending >= quota(org.planSnapshot).members)
        throw new ConflictException("Capacidade operacional de membros atingida.");
      await tx.accountInvitation.updateMany({
        where: {
          organizationId: principal.session.organizationId,
          email: input.email,
          status: "PENDING",
        },
        data: { status: "REVOKED" },
      });
      if (this.email?.configured())
        await this.email.enqueue(
          tx,
          input.email,
          "Convite para La fabrique",
          `Aceite o convite: ${this.email.publicUrl(`account-invite=${token}`)}\nVálido por 72 horas. Confirme seu email antes de aceitar.`,
        );
      const record = await tx.accountInvitation.create({
        data: {
          organizationId: principal.session.organizationId,
          email: input.email,
          role: input.role,
          tokenHash: digest(token),
          expiresAt: new Date(Date.now() + 72 * 3600_000),
        },
      });
      await this.audit(
        tx,
        principal.session.organizationId,
        principal.session.userId,
        "INVITATION_CREATED",
      );
      return {
        id: record.id,
        email: record.email,
        role: record.role,
        status: record.status,
        expiresAt: record.expiresAt.toISOString(),
      };
    });
    return { invitation, token };
  }
  async revokeInvitation(principal: AccountPrincipal, invitationId: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, principal.session.organizationId);
      const role = await this.role(tx, principal);
      const invitation = await tx.accountInvitation.findFirst({
        where: {
          id: invitationId,
          organizationId: principal.session.organizationId,
          status: "PENDING",
        },
      });
      if (!invitation) throw new NotFoundException("Convite não disponível.");
      assertMemberChange(role, "READER", invitation.role);
      await tx.accountInvitation.update({
        where: { id: invitation.id },
        data: { status: "REVOKED" },
      });
      await this.audit(
        tx,
        principal.session.organizationId,
        principal.session.userId,
        "INVITATION_REVOKED",
      );
    });
  }
  async acceptInvitation(principal: AccountPrincipal, token: string) {
    const invite = await this.prisma.accountInvitation.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!invite) throw new NotFoundException("Convite inválido ou expirado.");
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, invite.organizationId);
      const user = await tx.accountUser.findUniqueOrThrow({
        where: { id: principal.session.userId },
      });
      const invitation = await tx.accountInvitation.findUnique({ where: { id: invite.id } });
      if (
        !invitation ||
        !user.emailVerifiedAt ||
        invitation.email !== user.email ||
        invitation.status !== "PENDING" ||
        invitation.expiresAt <= new Date()
      )
        throw new NotFoundException("Convite inválido ou expirado para esta conta.");
      if (
        await tx.accountMembership.findUnique({
          where: {
            organizationId_userId: { organizationId: invite.organizationId, userId: user.id },
          },
        })
      )
        throw new ConflictException("Você já possui um vínculo com esta conta.");
      if ((await tx.accountMembership.count({ where: { userId: user.id } })) >= 200)
        throw new ConflictException("Capacidade operacional de contas atingida.");
      const org = await tx.accountOrganization.findUniqueOrThrow({
        where: { id: invite.organizationId },
      });
      if (
        org.archivedAt ||
        (await tx.accountMembership.count({
          where: { organizationId: org.id, status: "ACTIVE" },
        })) >= quota(org.planSnapshot).members
      )
        throw new ConflictException("A conta não pode receber novos membros agora.");
      await tx.accountMembership.create({
        data: { userId: user.id, organizationId: invite.organizationId, role: invitation.role },
      });
      await tx.accountInvitation.update({ where: { id: invite.id }, data: { status: "ACCEPTED" } });
      const updated = await tx.accountSession.updateMany({
        where: { id: principal.session.id },
        data: { organizationId: invite.organizationId },
      });
      if (!updated.count) throw new UnauthorizedException("Sessão expirada.");
      await this.audit(tx, invite.organizationId, user.id, "INVITATION_ACCEPTED");
    });
  }
  async member(principal: AccountPrincipal, membershipId: string, input: AccountMemberUpdate) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, principal.session.organizationId);
      const role = await this.role(tx, principal);
      const target = await tx.accountMembership.findFirst({
        where: { id: membershipId, organizationId: principal.session.organizationId },
      });
      if (!target) throw new NotFoundException("Membro não disponível.");
      assertMemberChange(role, target.role, input.role);
      if (target.version !== input.expectedVersion)
        throw new ConflictException("O membro mudou. Recarregue antes de salvar.");
      if (input.status === "ACTIVE" && target.status !== "ACTIVE") {
        const org = await tx.accountOrganization.findUniqueOrThrow({
          where: { id: target.organizationId },
        });
        const active = await tx.accountMembership.count({
          where: { organizationId: org.id, status: "ACTIVE" },
        });
        const pending = await tx.accountInvitation.count({
          where: { organizationId: org.id, status: "PENDING", expiresAt: { gt: new Date() } },
        });
        if (active + pending >= quota(org.planSnapshot).members)
          throw new ConflictException("Limite de membros atingido.");
      }
      await tx.accountMembership.update({
        where: { id: target.id },
        data: { role: input.role, status: input.status, version: { increment: 1 } },
      });
      if (input.status !== "ACTIVE")
        await tx.accountSession.deleteMany({
          where: { userId: target.userId, organizationId: target.organizationId },
        });
      await tx.accountNotification.create({
        data: {
          userId: target.userId,
          organizationId: target.organizationId,
          kind: "SECURITY",
          title: "Seu acesso foi atualizado",
          body: `Papel ${input.role} · ${input.status}`,
        },
      });
      await this.audit(tx, target.organizationId, principal.session.userId, "MEMBER_UPDATED");
    });
  }
  async sessions(principal: AccountPrincipal) {
    const items = await this.prisma.accountSession.findMany({
      where: { userId: principal.session.userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return items.map((item) => ({
      id: item.id,
      createdAt: item.createdAt.toISOString(),
      expiresAt: item.expiresAt.toISOString(),
      current: item.id === principal.session.id,
    }));
  }
  async revokeSession(principal: AccountPrincipal, sessionId: string) {
    await this.prisma.$transaction(async (tx) => {
      const removed = await tx.accountSession.deleteMany({
        where: { id: sessionId, userId: principal.session.userId },
      });
      if (!removed.count) throw new NotFoundException("Sessão não disponível.");
      await this.audit(
        tx,
        principal.session.organizationId,
        principal.session.userId,
        "SESSION_REVOKED",
      );
    });
  }
  async password(
    principal: AccountPrincipal,
    currentPassword: string,
    newPassword: string,
    factors: { otp?: string; recoveryCode?: string } = {},
  ) {
    const user = await this.prisma.accountUser.findUniqueOrThrow({
      where: { id: principal.session.userId },
    });
    if (!(await verifyPassword(currentPassword, user.passwordHash)))
      throw new ForbiddenException("Senha atual inválida.");
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_users WHERE id = ${user.id}::uuid FOR UPDATE`;
      const current = await tx.accountUser.findUniqueOrThrow({ where: { id: user.id } });
      await secondFactor(tx, current, factors);
      const changed = await tx.accountUser.updateMany({
        where: { id: user.id, passwordHash: user.passwordHash },
        data: { passwordHash, version: { increment: 1 } },
      });
      if (!changed.count) throw new ConflictException("A senha mudou. Entre novamente.");
      await tx.accountSession.deleteMany({
        where: { userId: user.id, id: { not: principal.session.id } },
      });
      await tx.accountSecurityToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
      });
      await this.audit(tx, principal.session.organizationId, user.id, "PASSWORD_CHANGED");
    });
  }
}
