import { describe, expect, it } from "vitest";
import {
  accountMemberUpdateSchema,
  accountPreferencesSchema,
  accountProfileUpdateSchema,
  accountRegisterSchema,
  accountSessionSchema,
} from "./account";

describe("user account contracts", () => {
  it("normalizes email and requires bounded strong passwords without trimming them", () => {
    const input = {
      name: " Alice ",
      email: "ALICE@example.test",
      password: "test-password-123",
      organizationName: " Team ",
    };
    expect(accountRegisterSchema.parse(input)).toMatchObject({
      name: "Alice",
      email: "alice@example.test",
      organizationName: "Team",
    });
    expect(accountRegisterSchema.safeParse({ ...input, password: "short" }).success).toBe(false);
    expect(
      accountRegisterSchema.safeParse({ ...input, tenantId: crypto.randomUUID() }).success,
    ).toBe(false);
  });
  it("validates real time zones, versions and rejects owner escalation", () => {
    const preferences = {
      locale: "pt-BR",
      timeZone: "America/Sao_Paulo",
      deliveryNotifications: true,
      executionNotifications: false,
    };
    expect(accountPreferencesSchema.safeParse(preferences).success).toBe(true);
    expect(
      accountPreferencesSchema.safeParse({ ...preferences, timeZone: "Invented/Zone" }).success,
    ).toBe(false);
    expect(
      accountProfileUpdateSchema.safeParse({ expectedVersion: 0, name: "Alice", preferences })
        .success,
    ).toBe(false);
    expect(
      accountMemberUpdateSchema.safeParse({ expectedVersion: 1, role: "OWNER", status: "ACTIVE" })
        .success,
    ).toBe(false);
  });
  it("cannot serialize session credentials or password hashes into a public DTO", () => {
    expect(
      accountSessionSchema.safeParse({ tokenHash: "private", passwordHash: "private" }).success,
    ).toBe(false);
  });
});
