import type { ProjectEventPage } from "@le-fabrique/contracts";
import { projectEventPageSchema } from "@le-fabrique/contracts";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { afterEach, expect, it, vi } from "vitest";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { ProjectEventsController, projectEventStream } from "./project-events.controller";
import { ProjectEventsService } from "./project-events.service";

const projectId = crypto.randomUUID();
function page(sequence = "1", after = "0"): ProjectEventPage {
  return projectEventPageSchema.parse({
    projectId,
    after,
    nextCursor: sequence,
    events: [
      {
        projectId,
        sequence,
        kind: "TICKET_CHANGED",
        entityId: crypto.randomUUID(),
        createdAt: "2026-10-03T20:00:00Z",
      },
    ],
  });
}
afterEach(() => vi.useRealTimers());

it("returns minimized bounded events after bigint cursor from persistence", async () => {
  const prisma = {
    project: { findUnique: vi.fn().mockResolvedValue({ id: projectId }) },
    projectEvent: {
      findMany: vi.fn().mockResolvedValue([
        {
          ...page("9007199254740993").events[0],
          sequence: 9007199254740993n,
          createdAt: new Date("2026-10-03T20:00:00Z"),
        },
      ]),
    },
  };
  const service = new ProjectEventsService(prisma as never);
  expect((await service.list(projectId, "9007199254740992")).nextCursor).toBe("9007199254740993");
  expect(prisma.projectEvent.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      take: 100,
      where: { projectId, sequence: { gt: 9007199254740992n } },
    }),
  );
  prisma.project.findUnique.mockResolvedValue(null);
  await expect(service.list(projectId, "0")).rejects.toThrow("Project not found");
});

it("streams sequentially with event ids and resumes without overlapping queries", async () => {
  vi.useFakeTimers();
  const first = page();
  const load = vi
    .fn()
    .mockResolvedValueOnce(first)
    .mockResolvedValue({ projectId, after: "1", nextCursor: "1", events: [] });
  const receive = vi.fn();
  const subscription = projectEventStream(load, "0").subscribe(receive);
  await vi.advanceTimersByTimeAsync(0);
  expect(receive).toHaveBeenCalledWith(
    expect.objectContaining({ id: "1", type: "project-change" }),
  );
  await vi.advanceTimersByTimeAsync(1000);
  expect(load).toHaveBeenLastCalledWith("1");
  expect(receive).toHaveBeenLastCalledWith(expect.objectContaining({ type: "heartbeat" }));
  subscription.unsubscribe();
  await vi.advanceTimersByTimeAsync(5000);
  expect(load).toHaveBeenCalledTimes(2);
  expect(vi.getTimerCount()).toBe(0);
});

it("discards a pending result after disconnect and sanitizes internal stream errors", async () => {
  let finish: ((value: ProjectEventPage) => void) | undefined;
  const receive = vi.fn();
  const subscription = projectEventStream(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    "0",
  ).subscribe(receive);
  subscription.unsubscribe();
  finish?.(page());
  await Promise.resolve();
  expect(receive).not.toHaveBeenCalled();
  const fail = vi.fn();
  projectEventStream(async () => {
    throw new Error("synthetic private database detail");
  }, "0").subscribe({ error: fail });
  await Promise.resolve();
  expect(fail.mock.calls[0]?.[0].message).toBe("Project event stream unavailable");
});

it("authenticates HTTP/SSE before reading and rejects invalid or overflowing cursors", async () => {
  const service = { list: vi.fn().mockResolvedValue(page()) };
  const token = "synthetic-event-administrator-with-32-characters";
  const module = await Test.createTestingModule({
    controllers: [ProjectEventsController],
    providers: [
      AdminAuthGuard,
      { provide: ConfigService, useValue: { getOrThrow: () => token } },
      { provide: ProjectEventsService, useValue: service },
    ],
  }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const url = `${await app.getUrl()}/projects/${projectId}/events`;
    for (const target of [url, `${url}/stream`]) expect((await fetch(target)).status).toBe(401);
    expect(service.list).not.toHaveBeenCalled();
    for (const after of ["-1", "1e9", "9223372036854775808", "01"]) {
      expect(
        (await fetch(`${url}?after=${after}`, { headers: { Authorization: `Bearer ${token}` } }))
          .status,
      ).toBe(400);
    }
    const accepted = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    expect(accepted.status).toBe(200);
    expect((await accepted.json()).events).toHaveLength(1);
    const cancellation = new AbortController();
    const streaming = await fetch(`${url}/stream`, {
      headers: { Authorization: `Bearer ${token}`, "Last-Event-ID": "0" },
      signal: AbortSignal.any([cancellation.signal, AbortSignal.timeout(3_000)]),
    });
    expect(streaming.headers.get("content-type")).toContain("text/event-stream");
    const reader = streaming.body?.getReader();
    expect(reader).toBeDefined();
    let received = "";
    while (!received.includes("project-change")) {
      const chunk = await reader?.read();
      if (chunk?.done) break;
      received += new TextDecoder().decode(chunk?.value);
    }
    expect(received).toContain("id: 1");
    cancellation.abort();
    await reader?.cancel().catch(() => undefined);
  } finally {
    await app.close();
  }
});
