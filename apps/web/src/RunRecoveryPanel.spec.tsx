import { runDetailSchema } from "@le-fabrique/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RunRecoveryPanel } from "./RunRecoveryPanel";

it("labels recovery as evidence-only, requiring confirmation without implying stop", () => {
  const time = new Date().toISOString();
  const run = runDetailSchema.parse({
    id: crypto.randomUUID(),
    ticketId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    title: "Ticket",
    status: "BLOCKED_RECOVERY",
    version: 3,
    createdAt: time,
    updatedAt: time,
    attempts: [
      {
        id: crypto.randomUUID(),
        sequence: 1,
        status: "RUNNING",
        stoppedConfirmed: false,
        startedAt: time,
        completedAt: null,
        result: null,
        resultDigest: null,
        checkpoint: null,
      },
    ],
  });
  const html = renderToStaticMarkup(<RunRecoveryPanel token="synthetic" run={run} />);
  expect(html).toContain("não presume que um processo morreu");
  expect(html).toContain("Não executa IA");
  expect(html).toContain('disabled=""');
  run.status = "DONE";
  expect(renderToStaticMarkup(<RunRecoveryPanel token="synthetic" run={run} />)).toBe("");
});
