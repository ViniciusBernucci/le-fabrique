import { randomUUID } from "node:crypto";
import {
  Inject,
  Injectable,
  type OnModuleDestroy,
  type OnModuleInit,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import nodemailer from "nodemailer";
import { PrismaService } from "../prisma.service";
import { decryptPrivate, encryptPrivate } from "./account-private";

@Injectable()
export class AccountEmailService implements OnModuleInit, OnModuleDestroy {
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  configured(): boolean {
    return (
      process.env.ACCOUNT_SMTP_ENABLED === "true" &&
      !!process.env.ACCOUNT_SMTP_HOST &&
      !!process.env.ACCOUNT_EMAIL_FROM &&
      !!process.env.ACCOUNT_PUBLIC_URL &&
      !!process.env.ACCOUNT_DATA_ENCRYPTION_KEY
    );
  }
  publicUrl(fragment: string): string {
    const value = process.env.ACCOUNT_PUBLIC_URL;
    if (!value)
      throw new ServiceUnavailableException("Configure a origem pública dos emails da conta.");
    const url = new URL(value);
    if (
      !["https:", ...(process.env.NODE_ENV === "production" ? [] : ["http:"])].includes(
        url.protocol,
      ) ||
      url.username ||
      url.password
    )
      throw new ServiceUnavailableException("Origem de email inválida.");
    url.hash = fragment;
    return url.toString();
  }
  async enqueue(
    tx: Prisma.TransactionClient,
    recipient: string,
    subject: string,
    text: string,
  ): Promise<void> {
    if (!this.configured())
      throw new ServiceUnavailableException("Envio de email ainda não configurado pelo operador.");
    const id = randomUUID();
    await tx.accountEmailJob.create({
      data: { id, recipient, subject, encryptedBody: encryptPrivate(text, `email:${id}`) },
    });
  }
  onModuleInit(): void {
    if (this.configured()) {
      this.timer = setInterval(() => void this.flush().catch(() => undefined), 5000);
      this.timer.unref();
    }
  }
  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }
  async flush(): Promise<void> {
    if (this.running || !this.configured()) return;
    this.running = true;
    try {
      const job = await this.prisma.$transaction(async (tx) => {
        await tx.accountEmailJob.updateMany({
          where: { status: "SENDING", claimedAt: { lt: new Date(Date.now() - 120000) } },
          data: { status: "PENDING" },
        });
        const rows = await tx.$queryRaw<
          { id: string }[]
        >`SELECT id FROM account_email_jobs WHERE status='PENDING' AND attempts<5 AND next_attempt_at<=NOW() ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED`;
        if (!rows[0]) return null;
        return tx.accountEmailJob.update({
          where: { id: rows[0].id },
          data: { status: "SENDING", claimedAt: new Date(), attempts: { increment: 1 } },
        });
      });
      if (!job) return;
      const transport = nodemailer.createTransport({
        host: process.env.ACCOUNT_SMTP_HOST,
        port: Number(process.env.ACCOUNT_SMTP_PORT ?? 587),
        secure: process.env.ACCOUNT_SMTP_SECURE === "true",
        requireTLS: process.env.NODE_ENV === "production",
        auth: process.env.ACCOUNT_SMTP_USER
          ? { user: process.env.ACCOUNT_SMTP_USER, pass: process.env.ACCOUNT_SMTP_PASSWORD }
          : undefined,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 20000,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      try {
        await transport.sendMail({
          from: process.env.ACCOUNT_EMAIL_FROM,
          to: job.recipient,
          subject: job.subject,
          text: decryptPrivate(job.encryptedBody, `email:${job.id}`),
          messageId: `<${job.id}@le-fabrique.local>`,
        });
        await this.prisma.accountEmailJob.update({
          where: { id: job.id },
          data: { status: "SENT", encryptedBody: "", claimedAt: null },
        });
      } catch {
        await this.prisma.accountEmailJob.update({
          where: { id: job.id },
          data: {
            status: job.attempts >= 5 ? "FAILED" : "PENDING",
            claimedAt: null,
            nextAttemptAt: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** job.attempts)),
          },
        });
      } finally {
        transport.close();
      }
    } finally {
      this.running = false;
    }
  }
}
