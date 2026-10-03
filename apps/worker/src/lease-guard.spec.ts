import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaseGuard } from "./lease-guard";

const expiry = (ms: number) => new Date(Date.now() + ms).toISOString();

describe("LeaseGuard", () => {
  afterEach(() => vi.useRealTimers());

  it("renews periodically and stops the timer when work completes", async () => {
    vi.useFakeTimers();
    const renew = vi.fn(async () => ({ leaseExpiresAt: expiry(30_000) }));
    const stopWriter = vi.fn(async () => true);
    const guard = new LeaseGuard({
      fencingToken: 7,
      leaseDurationMs: 30_000,
      initialLeaseExpiresAt: expiry(30_000),
      renewalIntervalMs: 5_000,
      renew,
      stopWriter,
    });
    const operation = guard.execute(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      return "ok";
    });
    await expect(operation).resolves.toBe("ok");
    expect(renew).toHaveBeenCalledTimes(2);
    expect(renew).toHaveBeenCalledWith(7);
    expect(stopWriter).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("aborts and requests writer quiescence once on the first renewal failure", async () => {
    vi.useFakeTimers();
    const renew = vi.fn().mockRejectedValue(new Error("control unavailable"));
    const stopWriter = vi.fn().mockResolvedValue(true);
    let signal: AbortSignal | undefined;
    const guard = new LeaseGuard({
      fencingToken: 7,
      leaseDurationMs: 30_000,
      initialLeaseExpiresAt: expiry(30_000),
      renewalIntervalMs: 5_000,
      renew,
      stopWriter,
    });
    const operation = guard.execute(async (abortSignal) => {
      signal = abortSignal;
      await new Promise<void>((resolve) => abortSignal.addEventListener("abort", () => resolve()));
      return "must not be accepted";
    });
    const rejected = expect(operation).rejects.toMatchObject({
      name: "LeaseAuthorityLostError",
      writerQuiescent: true,
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
    expect(signal?.aborted).toBe(true);
    expect(stopWriter).toHaveBeenCalledOnce();
  });

  it("records unconfirmed stop as non-quiescent and never returns work success", async () => {
    vi.useFakeTimers();
    const guard = new LeaseGuard({
      fencingToken: 7,
      leaseDurationMs: 30_000,
      initialLeaseExpiresAt: expiry(30_000),
      renewalIntervalMs: 5_000,
      renew: vi.fn().mockRejectedValue(new Error("offline")),
      stopWriter: vi.fn().mockResolvedValue(false),
    });
    const operation = guard.execute(async (signal) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", resolve));
      return "not accepted";
    });
    const rejected = expect(operation).rejects.toMatchObject({ writerQuiescent: false });
    await vi.advanceTimersByTimeAsync(5_000);
    await rejected;
  });

  it("fails closed when renewal hangs through the current lease expiry", async () => {
    vi.useFakeTimers();
    const stopWriter = vi.fn().mockResolvedValue(false);
    const guard = new LeaseGuard({
      fencingToken: 7,
      leaseDurationMs: 15_000,
      initialLeaseExpiresAt: expiry(15_000),
      renewalIntervalMs: 5_000,
      renew: () => new Promise<{ leaseExpiresAt: string }>(() => undefined),
      stopWriter,
    });
    const operation = guard.execute(async (signal) => {
      await new Promise<void>((resolve) => signal.addEventListener("abort", resolve));
    });
    const rejected = expect(operation).rejects.toMatchObject({ writerQuiescent: false });
    await vi.advanceTimersByTimeAsync(15_000);
    await rejected;
    expect(stopWriter).toHaveBeenCalledOnce();
  });

  it("validates lease timing before starting work", () => {
    expect(
      () =>
        new LeaseGuard({
          fencingToken: 7,
          leaseDurationMs: 15_000,
          initialLeaseExpiresAt: expiry(15_000),
          renewalIntervalMs: 15_000,
          renew: async () => ({ leaseExpiresAt: expiry(15_000) }),
          stopWriter: async () => true,
        }),
    ).toThrow("Lease duration and renewal interval are invalid");
  });
});
