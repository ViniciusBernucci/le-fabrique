import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { ForbiddenException, ServiceUnavailableException } from "@nestjs/common";
import type { AccountUser, Prisma } from "@prisma/client";
import { digest } from "./account-security";

function key(): Buffer {
  const value = process.env.ACCOUNT_DATA_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value))
    throw new ServiceUnavailableException(
      "Configure a chave privada da conta para usar segurança e integrações.",
    );
  return Buffer.from(value, "hex");
}
export function encryptPrivate(value: string, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    ciphertext.toString("hex"),
  ].join(":");
}
export function decryptPrivate(encoded: string, context: string): string {
  const [version, iv, tag, data] = encoded.split(":");
  if (version !== "v1" || !iv || !tag || data === undefined)
    throw new ServiceUnavailableException("Registro privado inválido.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "hex"));
  decipher.setAAD(Buffer.from(context));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(data, "hex")), decipher.final()]).toString(
    "utf8",
  );
}
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export function base32(bytes: Buffer): string {
  let bits = 0,
    value = 0,
    result = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
function unbase32(value: string): Buffer {
  let bits = 0,
    n = 0;
  const output: number[] = [];
  for (const char of value) {
    const digit = alphabet.indexOf(char);
    if (digit < 0) throw new Error("Invalid base32");
    n = (n << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      output.push((n >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}
export function totp(secret: string, step: bigint): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(step);
  const hash = createHmac("sha1", unbase32(secret)).update(counter).digest();
  const offset = (hash[19] ?? 0) & 15;
  const code = (hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, "0");
}
export function matchingStep(
  secret: string,
  otp: string,
  last: bigint | null,
  now = Date.now(),
): bigint | null {
  const step = BigInt(Math.floor(now / 30000));
  for (const drift of [0n, -1n, 1n]) {
    const candidate = step + drift;
    if (candidate < 0 || (last !== null && candidate <= last)) continue;
    if (
      /^\d{6}$/.test(otp) &&
      timingSafeEqual(Buffer.from(totp(secret, candidate)), Buffer.from(otp))
    )
      return candidate;
  }
  return null;
}
export async function secondFactor(
  tx: Prisma.TransactionClient,
  user: AccountUser,
  input: { otp?: string; recoveryCode?: string },
): Promise<void> {
  if (!user.mfaSecret) return;
  if (input.recoveryCode) {
    const hashes = Array.isArray(user.recoveryHashes) ? (user.recoveryHashes as string[]) : [];
    const hash = digest(input.recoveryCode);
    if (!hashes.includes(hash)) throw new ForbiddenException("Código de recuperação inválido.");
    await tx.accountUser.update({
      where: { id: user.id },
      data: { recoveryHashes: hashes.filter((item) => item !== hash) },
    });
    return;
  }
  const step = matchingStep(
    decryptPrivate(user.mfaSecret, `mfa:${user.id}`),
    input.otp ?? "",
    user.mfaLastStep,
  );
  if (step === null) throw new ForbiddenException("Informe um código válido do autenticador.");
  await tx.accountUser.update({ where: { id: user.id }, data: { mfaLastStep: step } });
}
