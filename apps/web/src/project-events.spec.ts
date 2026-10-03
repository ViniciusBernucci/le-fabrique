import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectEventDecoder, watchProjectEvents } from "./project-events";

const projectId = crypto.randomUUID();
function event(sequence = "1") {
  return {
    projectId,
    sequence,
    kind: "TICKET_CHANGED",
    entityId: crypto.randomUUID(),
    createdAt: "2026-10-03T20:00:00Z",
  };
}
function frame(value = event()) {
  return `id: ${value.sequence}\r\nevent: project-change\r\ndata: ${JSON.stringify(value)}\r\n\r\n`;
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("bounded project SSE decoder", () => {
  it("handles frames split at every CRLF boundary and resumes above the cursor", () => {
    const decoder = new ProjectEventDecoder(projectId, "1");
    const text = frame(event("2"));
    const values = [];
    for (const character of text) values.push(...decoder.push(character));
    expect(values).toHaveLength(1);
    expect(decoder.cursor).toBe("2");
  });
  it("ignores duplicate/older events and heartbeat without advancing backwards", () => {
    const decoder = new ProjectEventDecoder(projectId, "3");
    expect(
      decoder.push(
        [frame(event("2")), frame(event("3")), "event: heartbeat\ndata: {}\n\n"].join(""),
      ),
    ).toEqual([]);
    expect(decoder.cursor).toBe("3");
  });
  it.each(["project", "id", "secret", "kind"])(
    "rejects mismatched %s before delivering data",
    (mode) => {
      const value = event();
      const payload =
        mode === "project"
          ? { ...value, projectId: crypto.randomUUID() }
          : mode === "secret"
            ? { ...value, token: "synthetic" }
            : mode === "kind"
              ? { ...value, kind: "RAW_OUTPUT" }
              : value;
      const text = frame(payload).replace(mode === "id" ? "id: 1" : "no-match", "id: 2");
      expect(() => new ProjectEventDecoder(projectId).push(text)).toThrow();
    },
  );
  it("rejects an overlong buffer/frame before parsing it", () => {
    expect(() => new ProjectEventDecoder(projectId).push("x".repeat(65_537))).toThrow("buffer");
    expect(() =>
      new ProjectEventDecoder(projectId).push(`data: ${"x".repeat(16_385)}\n\n`),
    ).toThrow("frame");
  });
});

it("authenticates only in headers and reconnects with the last validated cursor", async () => {
  vi.useFakeTimers();
  const receive = vi.fn();
  const failed = vi.fn();
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(frame(event("7")), { headers: { "content-type": "text/event-stream" } }),
    )
    .mockResolvedValueOnce(new Response("", { headers: { "content-type": "text/event-stream" } }));
  vi.stubGlobal("fetch", fetchMock);
  const stop = watchProjectEvents(
    "/api/events",
    "synthetic-private-token",
    projectId,
    receive,
    failed,
  );
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(2_000);
  expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/events?after=7");
  expect(fetchMock.mock.calls[1]?.[1].headers["Last-Event-ID"]).toBe("7");
  expect(fetchMock.mock.calls[0]?.[1].headers.Authorization).toBe("Bearer synthetic-private-token");
  expect(fetchMock.mock.calls[0]?.[0]).not.toContain("token");
  stop();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("cancels reader and discards a reply after view cleanup", async () => {
  vi.useFakeTimers();
  let resolve: ((response: Response) => void) | undefined;
  const receive = vi.fn();
  const failed = vi.fn();
  const fetchMock = vi.fn(
    (_url: string, _init: RequestInit) =>
      new Promise<Response>((finish) => {
        resolve = finish;
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  const stop = watchProjectEvents("/api/events", "synthetic", projectId, receive, failed);
  stop();
  resolve?.(new Response(frame(), { headers: { "content-type": "text/event-stream" } }));
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).not.toHaveBeenCalled();
  expect(failed).not.toHaveBeenCalled();
  expect(fetchMock.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  expect(vi.getTimerCount()).toBe(0);
});
