import { expect, it } from "vitest";
import { readMarkdownInstructions } from "./markdown-instructions";

it("preserves Markdown whitespace, UTF-8, BOM and filename for download", async () => {
  const content = "\ufeff# Instruções\r\n\r\n    código\r\n";
  const result = await readMarkdownInstructions(new File([content], "AGENTS.MD"), 16_000);
  expect(result).toEqual({ instructions: content, instructionsFilename: "AGENTS.MD" });
});
it("rejects unsupported names, blank content, binary and invalid UTF-8", async () => {
  for (const file of [
    new File(["test"], "notes.txt"),
    new File(["test"], "../AGENTS.md"),
    new File([" \n\t"], "empty.md"),
    new File(["x\0y"], "binary.md"),
    new File([new Uint8Array([0xff])], "encoding.md"),
  ])
    await expect(readMarkdownInstructions(file, 16_000)).rejects.toThrow();
});
it("checks the character limit and bounds reads by byte size", async () => {
  await expect(
    readMarkdownInstructions(new File(["á".repeat(10)], "ok.md"), 10),
  ).resolves.toMatchObject({ instructions: "á".repeat(10) });
  await expect(
    readMarkdownInstructions(new File(["x".repeat(11)], "large.md"), 10),
  ).rejects.toThrow("10 caracteres");
  const huge = new File(["x".repeat(41)], "huge.md");
  huge.arrayBuffer = () => {
    throw new Error("must not read");
  };
  await expect(readMarkdownInstructions(huge, 10)).rejects.toThrow("10 caracteres");
});
