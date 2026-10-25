import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { AccountRole } from "@le-fabrique/contracts";
import {
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

let activeHashes = 0;
async function scrypt(password: string, salt: string): Promise<Buffer> {
  // Bound expensive work independently of identity/IP throttling.
  if (activeHashes >= 4)
    throw new ServiceUnavailableException("Autenticação ocupada. Tente novamente.");
  activeHashes++;
  try {
    return await new Promise<Buffer>((resolve, reject) => {
      scryptCallback(
        password,
        salt,
        64,
        { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
        (error, derivedKey) => {
          if (error) reject(error);
          else resolve(derivedKey);
        },
      );
    });
  } finally {
    activeHashes--;
  }
}
export const ACCOUNT_COOKIE = "lf_account_session";
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
export function secret(): string {
  return randomBytes(32).toString("hex");
}
export function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt)) as Buffer;
  return `scrypt-v1:${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [kind, salt, hash] = encoded.split(":");
  if (kind !== "scrypt-v1" || !salt || !hash || !/^[a-f0-9]{128}$/.test(hash)) return false;
  const actual = (await scrypt(password, salt)) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, "hex"));
}
export function readSessionCookie(cookie?: string): string {
  const value = cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCOUNT_COOKIE}=`))
    ?.slice(ACCOUNT_COOKIE.length + 1);
  if (!value || !/^[a-f0-9]{64}$/.test(value))
    throw new UnauthorizedException("Sessão inválida ou expirada.");
  return value;
}
export function assertCsrf(expected: string, provided?: string): void {
  if (!provided || !timingSafeEqual(Buffer.from(digest(expected)), Buffer.from(digest(provided))))
    throw new ForbiddenException("Recarregue a sessão antes de continuar.");
}
export function assertCanManage(role: AccountRole): void {
  if (role !== "OWNER" && role !== "ADMIN")
    throw new ForbiddenException("Sem permissão para administrar a equipe.");
}
export function assertMemberChange(actor: AccountRole, target: string, requested: string): void {
  assertCanManage(actor);
  if (target === "OWNER")
    throw new ForbiddenException("O proprietário deve permanecer ativo nesta versão.");
  if (actor !== "OWNER" && (target === "ADMIN" || requested === "ADMIN"))
    throw new ForbiddenException("Somente o proprietário administra outros administradores.");
}
