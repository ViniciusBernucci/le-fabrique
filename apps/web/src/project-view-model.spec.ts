import { describe, expect, it } from "vitest";
import { hasExecutableBaseRevision } from "./project-view-model";

describe("project view model", () => {
  it("distinguishes an executable commit revision from a branch label", () => {
    expect(hasExecutableBaseRevision("a".repeat(40))).toBe(true);
    expect(hasExecutableBaseRevision("main")).toBe(false);
    expect(hasExecutableBaseRevision("A".repeat(40))).toBe(false);
  });
});
