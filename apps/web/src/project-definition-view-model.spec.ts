import { describe, expect, it } from "vitest";
import { parseCheckArguments, parsePathLines } from "./project-definition-view-model";

describe("project definition view model", () => {
  it("normalizes path lines and preserves argv boundaries", () => {
    expect(parsePathLines(" src\n\ntests ")).toEqual(["src", "tests"]);
    expect(parseCheckArguments('["run", "test:unit"]')).toEqual(["run", "test:unit"]);
    expect(() => parseCheckArguments('"npm test"')).toThrow();
  });
});
