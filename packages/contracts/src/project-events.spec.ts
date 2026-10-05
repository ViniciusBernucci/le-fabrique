import { expect, it } from "vitest";
import { projectEventCursorSchema, projectEventPageSchema } from "./index";

it.each(["-1", "01", "1e9", "9223372036854775808", "x".repeat(1000)])(
  "rejects hostile cursor %s without throwing during safeParse",
  (value) => {
    expect(projectEventCursorSchema.safeParse(value).success).toBe(false);
  },
);
it("preserves bigint precision beyond JavaScript safe integer", () => {
  expect(projectEventCursorSchema.parse("9007199254740993")).toBe("9007199254740993");
});
it.each(["project", "reverse", "next", "secret", "bad-cursor"])(
  "rejects incoherent %s event page at the runtime boundary",
  (mode) => {
    const projectId = crypto.randomUUID();
    const event = {
      projectId,
      sequence: "2",
      kind: "RUN_CHANGED",
      entityId: crypto.randomUUID(),
      createdAt: "2026-10-03T20:00:00Z",
    };
    const page = { projectId, after: "1", nextCursor: "2", events: [event] };
    if (mode === "project") event.projectId = crypto.randomUUID();
    if (mode === "reverse") event.sequence = "1";
    if (mode === "next") page.nextCursor = "3";
    if (mode === "bad-cursor") page.after = "1e9";
    expect(
      projectEventPageSchema.safeParse(mode === "secret" ? { ...page, token: "synthetic" } : page)
        .success,
    ).toBe(false);
  },
);
