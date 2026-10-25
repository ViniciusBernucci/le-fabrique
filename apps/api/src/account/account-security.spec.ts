import { describe, expect, it } from "vitest";
import { type AccountRequest, assertAccountOrigin } from "./account.guard";
import {
  assertCanManage,
  assertCsrf,
  assertMemberChange,
  digest,
  hashPassword,
  readSessionCookie,
  secret,
  verifyPassword,
} from "./account-security";

describe("account security boundaries", () => {
  it("salts passwords and rejects wrong passwords and malformed hashes", async () => {
    const password = "fixture-password-123";
    const encoded = await hashPassword(password);
    expect(encoded).not.toContain(password);
    expect(await hashPassword(password)).not.toBe(encoded);
    expect(await verifyPassword(password, encoded)).toBe(true);
    expect(await verifyPassword("wrong", encoded)).toBe(false);
    expect(await verifyPassword(password, "scrypt:invalid")).toBe(false);
  });
  it("accepts only a well formed dedicated cookie, with no Bearer fallback", () => {
    const token = secret();
    expect(readSessionCookie(`other=value; lf_account_session=${token}; third=value`)).toBe(token);
    expect(() => readSessionCookie("adminToken=anything")).toThrow();
    expect(() => readSessionCookie("lf_account_session=invalid")).toThrow();
    expect(digest(token)).not.toBe(token);
  });
  it("requires an exact CSRF token", () => {
    const token = secret();
    expect(() => assertCsrf(token, token)).not.toThrow();
    expect(() => assertCsrf(token)).toThrow();
    expect(() => assertCsrf(token, `${token}x`)).toThrow();
  });
  it("protects owners and prevents admins granting or modifying admin roles", () => {
    expect(() => assertMemberChange("OWNER", "OWNER", "READER")).toThrow();
    expect(() => assertMemberChange("ADMIN", "READER", "ADMIN")).toThrow();
    expect(() => assertMemberChange("ADMIN", "ADMIN", "READER")).toThrow();
    expect(() => assertMemberChange("OWNER", "ADMIN", "READER")).not.toThrow();
    expect(() => assertCanManage("READER")).toThrow();
  });
  it("denies foreign/malformed origins and requests without a custom header", () => {
    const request = {
      headers: { "x-account-request": "1", host: "app.test", origin: "https://app.test" },
      method: "POST",
      socket: {},
    } as AccountRequest;
    expect(() => assertAccountOrigin(request)).not.toThrow();
    expect(() =>
      assertAccountOrigin({
        ...request,
        headers: { ...request.headers, origin: "https://evil.test" },
      }),
    ).toThrow();
    expect(() =>
      assertAccountOrigin({
        ...request,
        headers: { ...request.headers, "x-account-request": undefined },
      }),
    ).toThrow();
    expect(() => assertAccountOrigin(request, "https://other.test")).toThrow();
  });
});
