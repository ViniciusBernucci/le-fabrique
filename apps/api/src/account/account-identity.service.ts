import { randomBytes } from "node:crypto";
import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import type { AccountPrincipal } from "./account.service";
import { AccountEmailService } from "./account-email.service";
import {
  base32,
  decryptPrivate,
  encryptPrivate,
  matchingStep,
  secondFactor,
} from "./account-private";
import { digest, hashPassword, secret, verifyPassword } from "./account-security";

type Factors = { otp?: string; recoveryCode?: string };
@Injectable()
export class AccountIdentityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AccountEmailService) private readonly email: AccountEmailService,
  ) {}
  async requireSensitive(
    tx: Prisma.TransactionClient,
    principal: AccountPrincipal,
    input: Factors & { password: string },
  ) {
    await tx.$queryRaw`SELECT id FROM account_users WHERE id=${principal.session.userId}::uuid FOR UPDATE`;
    const user = await tx.accountUser.findUniqueOrThrow({
      where: { id: principal.session.userId },
    });
    if (!(await verifyPassword(input.password, user.passwordHash)))
      throw new ForbiddenException("Senha atual inválida.");
    await secondFactor(tx, user, input);
    return user;
  }
  private audit(tx: Prisma.TransactionClient, p: AccountPrincipal, action: string) {
    return tx.accountAuditEvent.create({
      data: { organizationId: p.session.organizationId, actorId: p.session.userId, action },
    });
  }
  private async token(tx: Prisma.TransactionClient, userId: string, kind: string, subject: string) {
    await tx.accountSecurityToken.updateMany({
      where: { userId, kind, usedAt: null },
      data: { usedAt: new Date() },
    });
    const token = secret();
    await tx.accountSecurityToken.create({
      data: {
        userId,
        kind,
        subject,
        tokenHash: digest(token),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    return token;
  }
  async verification(principal: AccountPrincipal) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_users WHERE id=${principal.session.userId}::uuid FOR UPDATE`;
      const user = await tx.accountUser.findUniqueOrThrow({
        where: { id: principal.session.userId },
      });
      await this.audit(tx, principal, "EMAIL_VERIFICATION_REQUESTED");
      const token = await this.token(tx, user.id, "VERIFY_EMAIL", user.email);
      await this.email.enqueue(
        tx,
        user.email,
        "Confirme seu email na La fabrique",
        `Confirme seu email: ${this.email.publicUrl(`account-verify=${token}`)}\nLink válido por uma hora.`,
      );
    });
  }
  async recover(email: string) {
    // Same public response for unknown emails. Configuration absence is explicit and not email dependent.
    if (!this.email.configured())
      await this.prisma.$transaction((tx) => this.email.enqueue(tx, email, "", ""));
    const user = await this.prisma.accountUser.findUnique({ where: { email } });
    if (!user?.emailVerifiedAt) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_users WHERE id=${user.id}::uuid FOR UPDATE`;
      const current = await tx.accountUser.findUniqueOrThrow({ where: { id: user.id } });
      if (!current.emailVerifiedAt || current.email !== email) return;
      const token = await this.token(tx, current.id, "RESET_PASSWORD", current.email);
      await this.email.enqueue(
        tx,
        user.email,
        "Recupere o acesso à La fabrique",
        `Redefina sua senha: ${this.email.publicUrl(`account-reset=${token}`)}\nVálido por uma hora. Seu segundo fator continua obrigatório.`,
      );
    });
  }
  async changeEmail(
    principal: AccountPrincipal,
    input: Factors & { password: string; email: string },
  ) {
    await this.prisma.$transaction(async (tx) => {
      const user = await this.requireSensitive(tx, principal, input);
      if (input.email === user.email) throw new ConflictException("Este já é seu email.");
      await this.audit(tx, principal, "EMAIL_CHANGE_REQUESTED");
      const token = await this.token(tx, user.id, "CHANGE_EMAIL", input.email);
      await this.email.enqueue(
        tx,
        input.email,
        "Confirme seu novo email",
        `Confirme a alteração: ${this.email.publicUrl(`account-verify=${token}`)}\nLink válido por uma hora.`,
      );
      await this.email.enqueue(
        tx,
        user.email,
        "Alteração de email solicitada",
        "Uma alteração de email foi solicitada. Se não foi você, altere sua senha e encerre suas sessões.",
      );
    });
  }
  async consume(token: string, password?: string, factors: Factors = {}) {
    const record = await this.prisma.accountSecurityToken.findUnique({
      where: { tokenHash: digest(token) },
    });
    if (!record) throw new NotFoundException("Link inválido ou expirado.");
    const passwordHash = password ? await hashPassword(password) : undefined;
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_users WHERE id=${record.userId}::uuid FOR UPDATE`;
      const current = await tx.accountSecurityToken.findUniqueOrThrow({ where: { id: record.id } });
      if (current.usedAt || current.expiresAt <= new Date())
        throw new NotFoundException("Link inválido ou expirado.");
      const user = await tx.accountUser.findUniqueOrThrow({ where: { id: record.userId } });
      if (record.kind !== "CHANGE_EMAIL" && user.email !== record.subject)
        throw new NotFoundException("Link inválido.");
      if (passwordHash) {
        if (record.kind !== "RESET_PASSWORD")
          throw new NotFoundException("Link de recuperação inválido.");
        await secondFactor(tx, user, factors);
        await tx.accountUser.update({
          where: { id: user.id },
          data: { passwordHash, version: { increment: 1 } },
        });
        await tx.accountSession.deleteMany({ where: { userId: user.id } });
      } else {
        if (!["VERIFY_EMAIL", "CHANGE_EMAIL"].includes(record.kind))
          throw new NotFoundException("Link de confirmação inválido.");
        await tx.accountUser.update({
          where: { id: user.id },
          data: { email: record.subject, emailVerifiedAt: new Date(), version: { increment: 1 } },
        });
        if (record.kind === "CHANGE_EMAIL")
          await tx.accountSession.deleteMany({ where: { userId: user.id } });
      }
      await tx.accountSecurityToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      if (passwordHash || record.kind === "CHANGE_EMAIL")
        await tx.accountSecurityToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });
    });
  }
  async prepareMfa(principal: AccountPrincipal, input: Factors & { password: string }) {
    const seed = base32(randomBytes(20));
    await this.prisma.$transaction(async (tx) => {
      const user = await this.requireSensitive(tx, principal, input);
      if (user.mfaSecret) throw new ConflictException("O segundo fator já está ativo.");
      await tx.accountUser.update({
        where: { id: user.id },
        data: {
          mfaPendingSecret: encryptPrivate(seed, `mfa:${user.id}`),
          mfaPendingExpiresAt: new Date(Date.now() + 600000),
        },
      });
    });
    const user = await this.prisma.accountUser.findUniqueOrThrow({
      where: { id: principal.session.userId },
    });
    return {
      secret: seed,
      uri: `otpauth://totp/${encodeURIComponent(`La fabrique:${user.email}`)}?secret=${seed}&issuer=La%20fabrique&digits=6&period=30`,
    };
  }
  async confirmMfa(principal: AccountPrincipal, otp: string) {
    const codes = Array.from({ length: 10 }, () => randomBytes(8).toString("hex"));
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM account_users WHERE id=${principal.session.userId}::uuid FOR UPDATE`;
      const user = await tx.accountUser.findUniqueOrThrow({
        where: { id: principal.session.userId },
      });
      if (
        !user.mfaPendingSecret ||
        !user.mfaPendingExpiresAt ||
        user.mfaPendingExpiresAt <= new Date()
      )
        throw new ConflictException("A configuração expirou. Reinicie.");
      const step = matchingStep(decryptPrivate(user.mfaPendingSecret, `mfa:${user.id}`), otp, null);
      if (step === null) throw new ForbiddenException("Código inválido.");
      await tx.accountUser.update({
        where: { id: user.id },
        data: {
          mfaSecret: user.mfaPendingSecret,
          mfaPendingSecret: null,
          mfaPendingExpiresAt: null,
          mfaLastStep: step,
          recoveryHashes: codes.map(digest),
          version: { increment: 1 },
        },
      });
      await this.audit(tx, principal, "MFA_ENABLED");
      await tx.accountSession.deleteMany({
        where: { userId: user.id, id: { not: principal.session.id } },
      });
    });
    return { recoveryCodes: codes };
  }
  async disableMfa(principal: AccountPrincipal, input: Factors & { password: string }) {
    await this.prisma.$transaction(async (tx) => {
      const user = await this.requireSensitive(tx, principal, input);
      await tx.accountUser.update({
        where: { id: user.id },
        data: {
          mfaSecret: null,
          mfaPendingSecret: null,
          mfaPendingExpiresAt: null,
          mfaLastStep: null,
          recoveryHashes: [],
          version: { increment: 1 },
        },
      });
      await this.audit(tx, principal, "MFA_DISABLED");
      await tx.accountSession.deleteMany({
        where: { userId: user.id, id: { not: principal.session.id } },
      });
    });
  }
}
