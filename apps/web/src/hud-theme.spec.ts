/// <reference types="node" />
import { readFileSync } from "node:fs";
import { ticketStatusSchema } from "@le-fabrique/contracts";
import { expect, it } from "vitest";
import { stages } from "./tasks-model";

it("covers every current workflow status without introducing illustrative kit enums", () => {
  const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");
  const statuses = [...css.matchAll(/\[data-hud-status="([A-Z_]+)"\]/g)].map((match) => match[1]);
  expect(statuses.sort()).toEqual([...ticketStatusSchema.options].sort());
});

it("stops all CSS animation in reduced motion, including inline durations", () => {
  const css = readFileSync(new URL("./theme-hud.css", import.meta.url), "utf8");
  expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  expect(css).toContain("animation: none !important");
  const component = readFileSync(new URL("./OrchestrationCore.tsx", import.meta.url), "utf8");
  expect(component).not.toContain("<animateMotion");
  expect(component).not.toContain("Math.random");
});

it("covers the nine demonstration stages separately from persisted workflow states", () => {
  const css = readFileSync(new URL("./tasks.css", import.meta.url), "utf8");
  const mapped = [...css.matchAll(/\[data-task-stage="([^"]+)"\]/g)].map((match) => match[1]);
  expect(mapped.sort()).toEqual([...stages].sort());
});
