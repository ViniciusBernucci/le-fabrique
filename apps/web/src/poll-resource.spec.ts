import { afterEach, describe, expect, it, vi } from "vitest";
import { pollResource } from "./poll-resource";

describe("execution polling", () => {
  afterEach(() => vi.useRealTimers());
  it("discards a late response after the view is cancelled", async () => {
    let finish: ((value: string) => void) | undefined;
    let signal: AbortSignal | undefined;
    const receive = vi.fn();
    const fail = vi.fn();
    const stop = pollResource(
      (input) => {
        signal = input;
        return new Promise<string>((resolve) => {
          finish = resolve;
        });
      },
      receive,
      fail,
    );
    stop();
    finish?.("old project");
    await Promise.resolve();
    expect(signal?.aborted).toBe(true);
    expect(receive).not.toHaveBeenCalled();
    expect(fail).not.toHaveBeenCalled();
  });
  it("never overlaps requests and clears its timer on cleanup", async () => {
    vi.useFakeTimers();
    let finish: (() => void) | undefined;
    const load = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const stop = pollResource(load, vi.fn(), vi.fn());
    await vi.advanceTimersByTimeAsync(30_000);
    expect(load).toHaveBeenCalledOnce();
    finish?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(load).toHaveBeenCalledTimes(2);
    stop();
    finish?.();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(load).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
