import { createCipheriv, randomBytes } from "node:crypto";
import { ServiceUnavailableException } from "@nestjs/common";

/** Dedicated key, supplied by deployment; never reuse an admin token. */
export function encryptProviderApiKey(
  installationId: string,
  provider: string,
  secret: string,
): string {
  const encoded = process.env.PROVIDER_API_KEY_ENCRYPTION_KEY;
  if (!encoded || !/^[a-fA-F0-9]{64}$/.test(encoded))
    throw new ServiceUnavailableException(
      "API key storage requires PROVIDER_API_KEY_ENCRYPTION_KEY",
    );
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(encoded, "hex"), iv);
  cipher.setAAD(Buffer.from(`${installationId}:${provider}`));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}
