import { chmod, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { executionResultReportSchema, type OrchestrationJob } from "@le-fabrique/contracts";
import { afterEach, describe, expect, it } from "vitest";
import { type ResultFinalizationIntent, ResultJournal } from "./result-journal";

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), "fac-012o-journal-"));
  roots.push(root);
  const attemptId = crypto.randomUUID();
  const job: OrchestrationJob = {
    schemaVersion: 1,
    eventId: crypto.randomUUID(),
    projectId: crypto.randomUUID(),
    ticketId: crypto.randomUUID(),
    ticketVersion: 1,
    projectDefinitionVersion: 1,
    baseRevision: "a".repeat(40),
    executionSpecification: null,
  };
  const intent: ResultFinalizationIntent = {
    attemptId,
    runId: crypto.randomUUID(),
    fencingToken: 7,
    outcome: "FAILED",
    checkpoint: {
      baseRevision: "a".repeat(40),
      codeRevision: "a".repeat(40),
      snapshotId: null,
      patchHash: null,
      reason: "FAILED",
      stoppedConfirmed: true,
    },
    result: executionResultReportSchema.parse({
      schemaVersion: 1,
      workflowId: attemptId,
      status: "FAILED",
      reason: "RUNTIME_ROUTE_UNAVAILABLE",
      developerExecutions: 0,
      reviewerExecutions: 0,
      corrections: 0,
      checks: [],
      snapshots: [],
      review: null,
      diagnostic: "No route",
      runtimeObservations: [],
    }),
  };
  return {
    root,
    job,
    intent,
    journal: new ResultJournal(root),
    file: path.join(root, `${job.eventId}.json`),
  };
}
describe("immutable private result journal", () => {
  it("preserves waiting provider outcome and rejects an inconsistent checkpoint", async () => {
    const f = await fixture();
    f.intent.result.status = "WAITING_PROVIDER";
    f.intent.result.reason = "PROVIDER_UNAVAILABLE";
    f.intent.outcome = "WAITING_PROVIDER";
    await expect(f.journal.save(f.job, f.intent)).rejects.toThrow();
    f.intent.checkpoint.reason = "WAITING_PROVIDER";
    await f.journal.save(f.job, f.intent);
    expect((await f.journal.load(f.job))?.outcome).toBe("WAITING_PROVIDER");
  });
  it("publishes durable bounded data and reads it from a new instance", async () => {
    const f = await fixture();
    await expect(f.journal.load(f.job)).resolves.toBeNull();
    await f.journal.save(f.job, f.intent);
    expect((await stat(f.file)).mode & 0o777).toBe(0o600);
    expect(await new ResultJournal(f.root).load(f.job)).toEqual(f.intent);
    const bytes = await readFile(f.file, "utf8");
    expect(bytes).not.toContain("workspacePath");
    expect(bytes).not.toContain("prompt");
  });
  it("accepts exact repetition but never overwrites different content", async () => {
    const f = await fixture();
    await f.journal.save(f.job, f.intent);
    await f.journal.save(f.job, f.intent);
    await expect(f.journal.save(f.job, { ...f.intent, fencingToken: 8 })).rejects.toThrow(
      "immutable",
    );
    expect(await f.journal.load(f.job)).toEqual(f.intent);
  });
  it("rejects altered job binding and corrupted evidence", async () => {
    const f = await fixture();
    await f.journal.save(f.job, f.intent);
    await expect(f.journal.load({ ...f.job, ticketVersion: 2 })).rejects.toThrow(
      "binding mismatch",
    );
    const bytes = JSON.parse(await readFile(f.file, "utf8"));
    bytes.intent.fencingToken = 8;
    await writeFile(f.file, JSON.stringify(bytes));
    await expect(f.journal.load(f.job)).rejects.toThrow("integrity");
  });
  it("rejects symlinks at root and entry without following targets", async () => {
    const f = await fixture();
    await symlink(f.root, path.join(f.root, "alias"));
    await expect(new ResultJournal(path.join(f.root, "alias")).load(f.job)).rejects.toThrow(
      "without symlinks",
    );
    const target = path.join(f.root, "private-target");
    await writeFile(target, "untouched", { mode: 0o600 });
    await symlink(target, f.file);
    await expect(f.journal.load(f.job)).rejects.toThrow();
    expect(await readFile(target, "utf8")).toBe("untouched");
  });
  it("rejects oversized entries and public directory permissions", async () => {
    const f = await fixture();
    await writeFile(f.file, "x".repeat(131_073), { mode: 0o600 });
    await expect(f.journal.load(f.job)).rejects.toThrow("Unsafe journal entry");
    await chmod(f.root, 0o755);
    await expect(f.journal.load(f.job)).rejects.toThrow("private");
  });
  it("refuses stop/outcome/private-field inventions before publishing", async () => {
    const f = await fixture();
    await expect(
      f.journal.save(f.job, {
        ...f.intent,
        checkpoint: { ...f.intent.checkpoint, stoppedConfirmed: false },
      }),
    ).rejects.toThrow();
    await expect(f.journal.save(f.job, { ...f.intent, outcome: "VALIDATING" })).rejects.toThrow();
    await expect(
      f.journal.save(f.job, {
        ...f.intent,
        result: { ...f.intent.result, prompt: "forbidden" },
      } as never),
    ).rejects.toThrow();
    expect(await f.journal.load(f.job)).toBeNull();
  });

  it("preserves cancelled stopped evidence without reclassifying it as failure", async () => {
    const f = await fixture();
    const intent = {
      ...f.intent,
      outcome: "CANCELLED" as const,
      checkpoint: { ...f.intent.checkpoint, reason: "CANCELLED" as const },
      result: { ...f.intent.result, status: "CANCELLED" as const, reason: "INTERRUPTED" as const },
    };
    await f.journal.save(f.job, intent);
    expect(await f.journal.load(f.job)).toEqual(intent);
  });
});
