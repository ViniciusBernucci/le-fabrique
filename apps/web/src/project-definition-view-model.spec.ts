import { describe, expect, it } from "vitest";
import {
  formatContextSourceLines,
  parseCheckArguments,
  parseContextSourceLines,
  parsePathLines,
} from "./project-definition-view-model";

describe("project definition view model", () => {
  it("normalizes path lines and preserves argv boundaries", () => {
    expect(parsePathLines(" src\n\ntests ")).toEqual(["src", "tests"]);
    expect(parseCheckArguments('["run", "test:unit"]')).toEqual(["run", "test:unit"]);
    expect(() => parseCheckArguments('"npm test"')).toThrow();
  });

  it("parses and formats explicit context sources without accepting unknown roles", () => {
    const sources = [
      { path: "README.md", role: "INSTRUCTION" as const },
      { path: "src/main.ts", role: "SOURCE" as const },
    ];
    expect(parseContextSourceLines(formatContextSourceLines(sources))).toEqual(sources);
    expect(() => parseContextSourceLines("README.md | ADMIN")).toThrow();
    expect(() => parseContextSourceLines("README.md | INSTRUCTION | extra")).toThrow();
  });
});
