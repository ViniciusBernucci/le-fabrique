import { describe, expect, it, vi } from "vitest";
import type { WorkerConfig } from "./config";
import {
  ControlClient,
  ControlRequestError,
  registerWithRetry,
  startHeartbeat,
} from "./control-client";

const config: WorkerConfig = {
  NODE_ENV: "test",
  REDIS_URL: "redis://127.0.0.1:6379",
  WORKER_CONCURRENCY: 1,
  CONTROL_API_URL: "http://control.test/api",
  WORKER_API_TOKEN: "x".repeat(32),
  WORKER_ID: "00000000-0000-4000-8000-000000000001",
  WORKER_NAME: "test-worker",
  WORKER_HEARTBEAT_INTERVAL_MS: 1000,
};

describe("ControlClient", () => {
  it("fetches a validated worker configuration snapshot without sending credentials in the body", async () => {
    const observedAt = "2026-10-02T12:00:00.000Z";
    const configuration = {
      installations: [],
      assignments: ["PLANNER", "DEVELOPER", "REVIEWER", "QA", "DOCUMENTATION", "SECURITY"].map(
        (role) => ({
          role,
          enabled: false,
          installationId: null,
          model: null,
          permissionMode: role === "DEVELOPER" ? "WORKSPACE_WRITE" : "READ_ONLY",
          timeoutMinutes: 30,
          maxAttempts: 2,
        }),
      ),
      github: {
        authMode: "GH_CLI",
        state: "DISCONNECTED",
        host: "github.com",
        owner: null,
        repository: null,
        baseBranch: "main",
        pullRequestCreationEnabled: false,
        mergeEnabled: false,
      },
      financialSafety: {
        apiEnabled: false,
        extraUsageEnabled: false,
        paidCreditsEnabled: false,
        autoRechargeEnabled: false,
        paidFallbackEnabled: false,
      },
    };
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: 4, observedAt, configuration }),
    });
    const client = new ControlClient(config, fetcher as never);

    await expect(client.getWorkerConfiguration()).resolves.toEqual({
      version: 4,
      observedAt,
      configuration,
    });
    expect(fetcher).toHaveBeenCalledWith(
      `${config.CONTROL_API_URL}/internal/worker-settings`,
      expect.objectContaining({ method: "GET" }),
    );
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(request.headers).toMatchObject({ authorization: `Bearer ${config.WORKER_API_TOKEN}` });
    expect(request.body).toBeUndefined();
  });

  it("registers without exposing the worker credential in the body", async () => {
    const now = "2026-09-30T12:00:00.000Z";
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: config.WORKER_ID,
        name: config.WORKER_NAME,
        capabilities: ["probe", "subscription-client-preflight"],
        os: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        status: "ONLINE",
        lastHeartbeatAt: now,
        createdAt: now,
        updatedAt: now,
      }),
    });
    const client = new ControlClient(config, fetcher as never);
    await expect(client.register()).resolves.toMatchObject({
      id: config.WORKER_ID,
      status: "ONLINE",
    });
    const request = fetcher.mock.calls[0]?.[1] as RequestInit;
    expect(request.body).not.toContain(config.WORKER_API_TOKEN);
    expect(request.headers).toMatchObject({ authorization: `Bearer ${config.WORKER_API_TOKEN}` });
  });

  it("signals control loss after three consecutive heartbeat failures", async () => {
    vi.useFakeTimers();
    const client = { heartbeat: vi.fn().mockRejectedValue(new Error("offline")) };
    const unavailable = vi.fn();
    const stop = startHeartbeat(client as never, 1000, unavailable);
    await vi.advanceTimersByTimeAsync(3000);
    expect(unavailable).toHaveBeenCalledOnce();
    stop();
    vi.useRealTimers();
  });

  it("retries transient registration failures and stops after success", async () => {
    const client = {
      register: vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockRejectedValueOnce(new ControlRequestError(503))
        .mockResolvedValue({}),
    };
    const wait = vi.fn().mockResolvedValue(undefined);
    const onRetry = vi.fn();

    await expect(
      registerWithRetry(client, { maxAttempts: 30, delayMs: 1000, wait, onRetry }),
    ).resolves.toBeUndefined();
    expect(client.register).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
    expect(wait).toHaveBeenNthCalledWith(1, 1000);
    expect(onRetry).toHaveBeenLastCalledWith({
      failedAttempt: 2,
      maxAttempts: 30,
      delayMs: 1000,
    });
  });

  it("preserves the last transient error after exhausting registration attempts", async () => {
    const error = new TypeError("fetch failed");
    const client = { register: vi.fn().mockRejectedValue(error) };
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(registerWithRetry(client, { maxAttempts: 3, delayMs: 1000, wait })).rejects.toBe(
      error,
    );
    expect(client.register).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent registration response", async () => {
    const error = new ControlRequestError(401);
    const client = { register: vi.fn().mockRejectedValue(error) };
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(registerWithRetry(client, { wait })).rejects.toBe(error);
    expect(client.register).toHaveBeenCalledOnce();
    expect(wait).not.toHaveBeenCalled();
  });
});
