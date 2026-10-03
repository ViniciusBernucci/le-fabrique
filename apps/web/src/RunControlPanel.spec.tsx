import { runDetailSchema } from "@le-fabrique/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RunControlPanel } from "./RunControlPanel";

function fixture() {
  const timestamp = new Date().toISOString();
  return runDetailSchema.parse({
    id: crypto.randomUUID(),
    ticketId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    title: "Ticket",
    status: "RUNNING",
    version: 2,
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: [
      {
        id: crypto.randomUUID(),
        sequence: 1,
        status: "RUNNING",
        stoppedConfirmed: false,
        startedAt: timestamp,
        completedAt: null,
        result: null,
        resultDigest: null,
        checkpoint: null,
      },
    ],
  });
}
it("requires confirmation and does not equate pending pause to confirmed stop", () => {
  const run = fixture();
  const html = renderToStaticMarkup(<RunControlPanel token="synthetic" run={run} />);
  expect(html).toContain("Confirmo que desejo interromper");
  expect(html).toContain('disabled=""');
  expect(html).not.toContain("Retomar");
  run.controlAction = "PAUSE";
  const pending = renderToStaticMarkup(<RunControlPanel token="synthetic" run={run} />);
  expect(pending).toContain("parada ainda não confirmada");
  expect(pending).not.toContain("Cancelar execução");
});
it("offers no control for terminal or already stopped attempts", () => {
  const run = fixture();
  run.status = "PAUSED";
  expect(renderToStaticMarkup(<RunControlPanel token="synthetic" run={run} />)).toBe("");
  run.status = "RUNNING";
  const attempt = run.attempts[0];
  if (!attempt) throw new Error("Fixture attempt missing");
  attempt.stoppedConfirmed = true;
  expect(renderToStaticMarkup(<RunControlPanel token="synthetic" run={run} />)).toBe("");
});
