import { createHmac } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { validateAvatar } from "./account-avatar";
import { planCatalog, verifyStripeSignature } from "./account-billing.service";
import { base32, decryptPrivate, encryptPrivate, matchingStep, totp } from "./account-private";

afterEach(() => vi.unstubAllEnvs());
it("matches RFC 6238 SHA1 vectors with the configured six digits", () => {
  const seed = base32(Buffer.from("12345678901234567890"));
  for (const [seconds, code] of [
    [59, "287082"],
    [1111111109, "081804"],
    [1111111111, "050471"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ] as const)
    expect(totp(seed, BigInt(Math.floor(seconds / 30)))).toBe(code);
});
it("rejects a reused TOTP step and accepts only the bounded clock window", () => {
  const seed = base32(Buffer.from("12345678901234567890"));
  expect(matchingStep(seed, "287082", null, 59000)).toBe(1n);
  expect(matchingStep(seed, "287082", 1n, 59000)).toBeNull();
  expect(matchingStep(seed, "287082", null, 160000)).toBeNull();
});
it("encrypts secrets and binds ciphertext to its owner", () => {
  vi.stubEnv("ACCOUNT_DATA_ENCRYPTION_KEY", "01".repeat(32));
  const ciphertext = encryptPrivate("fixture-private", "integration:one");
  expect(ciphertext).not.toContain("fixture-private");
  expect(decryptPrivate(ciphertext, "integration:one")).toBe("fixture-private");
  expect(() => decryptPrivate(ciphertext, "integration:other")).toThrow();
  vi.stubEnv("ACCOUNT_DATA_ENCRYPTION_KEY", "");
  expect(() => encryptPrivate("fixture-private", "one")).toThrow();
});
it("requires an authentic fresh signature over the unchanged raw webhook body", () => {
  const raw = Buffer.from('{"id":"evt_fixture"}');
  const now = 1800000000000;
  const stamp = String(now / 1000);
  const digest = createHmac("sha256", "fixture-webhook-key")
    .update(`${stamp}.`)
    .update(raw)
    .digest("hex");
  expect(() =>
    verifyStripeSignature(raw, `t=${stamp},v1=${digest}`, "fixture-webhook-key", now),
  ).not.toThrow();
  expect(() =>
    verifyStripeSignature(Buffer.from("{}"), `t=${stamp},v1=${digest}`, "fixture-webhook-key", now),
  ).toThrow();
  expect(() =>
    verifyStripeSignature(raw, `t=${stamp},v1=${digest}`, "fixture-webhook-key", now + 301000),
  ).toThrow();
});
it("does not invent a commercial plan when the catalog is absent or malformed", () => {
  vi.stubEnv("ACCOUNT_PLAN_CATALOG", "");
  expect(planCatalog()).toEqual([]);
  vi.stubEnv("ACCOUNT_PLAN_CATALOG", "{}");
  expect(() => planCatalog()).toThrow();
});

it("rejects vector avatars and oversized raster dimensions", () => {
  expect(() => validateAvatar("data:image/svg+xml;base64,PHN2Zy8+")).toThrow();
  const bytes = Buffer.alloc(24);
  Buffer.from("89504e470d0a1a0a", "hex").copy(bytes);
  bytes.write("IHDR", 12);
  bytes.writeUInt32BE(128, 16);
  bytes.writeUInt32BE(128, 20);
  expect(() => validateAvatar(`data:image/png;base64,${bytes.toString("base64")}`)).not.toThrow();
  bytes.writeUInt32BE(1000000, 16);
  expect(() => validateAvatar(`data:image/png;base64,${bytes.toString("base64")}`)).toThrow();
});
