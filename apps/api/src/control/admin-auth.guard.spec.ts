import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { AdminAuthGuard } from "./admin-auth.guard";

function context(authorization?: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as never;
}

describe("AdminAuthGuard", () => {
  const guard = new AdminAuthGuard(new ConfigService({ ADMIN_API_TOKEN: "a".repeat(32) }));

  it("accepts only the configured bearer token", () => {
    expect(guard.canActivate(context(`Bearer ${"a".repeat(32)}`))).toBe(true);
    expect(() => guard.canActivate(context("Bearer invalid"))).toThrow(
      "Invalid administrative credentials",
    );
    expect(() => guard.canActivate(context())).toThrow("Invalid administrative credentials");
  });
});
