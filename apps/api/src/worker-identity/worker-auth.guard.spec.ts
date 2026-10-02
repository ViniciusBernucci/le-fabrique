import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { describe, expect, it } from "vitest";
import { WorkerAuthGuard } from "./worker-auth.guard";

function context(authorization?: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ headers: { authorization } }) }),
  } as never;
}

describe("WorkerAuthGuard", () => {
  const token = "w".repeat(32);
  const guard = new WorkerAuthGuard(new ConfigService({ WORKER_API_TOKEN: token }));

  it("accepts only the configured worker bearer token", () => {
    expect(guard.canActivate(context(`Bearer ${token}`))).toBe(true);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context("Bearer wrong"))).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context(`Bearer ${"a".repeat(32)}`))).toThrow(
      "Invalid worker credentials",
    );
  });
});
