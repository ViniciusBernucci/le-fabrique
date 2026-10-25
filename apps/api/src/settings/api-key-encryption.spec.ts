import { createDecipheriv } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { encryptProviderApiKey } from "./api-key-encryption";

afterEach(() => vi.unstubAllEnvs());
it("requires a dedicated encryption key instead of silently storing plaintext", () => {
  vi.stubEnv("PROVIDER_API_KEY_ENCRYPTION_KEY", "");
  expect(() => encryptProviderApiKey("api-test", "CODEX", "synthetic-key")).toThrow(
    "API key storage requires",
  );
});
it("encrypts with a random nonce and binds ciphertext to account and provider", () => {
  vi.stubEnv("PROVIDER_API_KEY_ENCRYPTION_KEY", "ab".repeat(32));
  const value = encryptProviderApiKey("api-test", "CODEX", "synthetic-key");
  expect(value).not.toContain("synthetic-key");
  expect(encryptProviderApiKey("api-test", "CODEX", "synthetic-key")).not.toBe(value);
  const [, iv, tag, encrypted] = value.split(":");
  function decrypt(identity: string) {
    const cipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from("ab".repeat(32), "hex"),
      Buffer.from(iv, "base64"),
    );
    cipher.setAAD(Buffer.from(identity));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      cipher.update(Buffer.from(encrypted, "base64")),
      cipher.final(),
    ]).toString();
  }
  expect(decrypt("api-test:CODEX")).toBe("synthetic-key");
  expect(() => decrypt("api-other:CODEX")).toThrow();
});
