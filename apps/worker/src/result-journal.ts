import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import type { OrchestrationJob } from "@le-fabrique/contracts";
import {
  executionResultReportSchema,
  orchestrationCheckpointRequestSchema,
  orchestrationCompleteRequestSchema,
  orchestrationJobSchema,
} from "@le-fabrique/contracts";
import { z } from "zod";

const intentSchema = z
  .object({
    runId: z.uuid(),
    attemptId: z.uuid(),
    fencingToken: z.number().int().positive(),
    result: executionResultReportSchema,
    checkpoint: orchestrationCheckpointRequestSchema
      .omit({ workerId: true, fencingToken: true })
      .strict(),
    outcome: orchestrationCompleteRequestSchema.shape.outcome,
  })
  .strict()
  .superRefine((intent, context) => {
    const snapshot = intent.result.snapshots.at(-1);
    const approved =
      intent.result.status === "AWAITING_HUMAN" && intent.result.reason === "APPROVED";
    const outcome =
      intent.result.status === "CANCELLED"
        ? "CANCELLED"
        : approved
          ? "VALIDATING"
          : intent.result.status === "PAUSED_LIMIT"
            ? "PAUSED_LIMIT"
            : "FAILED";
    const reason =
      outcome === "CANCELLED"
        ? "CANCELLED"
        : approved
          ? "COMPLETED"
          : outcome === "PAUSED_LIMIT"
            ? "PAUSED"
            : "FAILED";
    if (
      intent.result.workflowId !== intent.attemptId ||
      !intent.checkpoint.stoppedConfirmed ||
      intent.result.checks.some((check) => !check.stoppedConfirmed) ||
      intent.outcome !== outcome ||
      intent.checkpoint.reason !== reason ||
      intent.checkpoint.snapshotId !== (snapshot?.snapshotId ?? null) ||
      intent.checkpoint.patchHash !== (snapshot?.manifestHash ?? null) ||
      (snapshot &&
        (intent.checkpoint.baseRevision !== snapshot.baseRevision ||
          intent.checkpoint.codeRevision !== snapshot.headRevision))
    )
      context.addIssue({ code: "custom", message: "Invalid stopped finalization evidence" });
  });
export type ResultFinalizationIntent = z.infer<typeof intentSchema>;
export interface ResultJournalPort {
  load(job: OrchestrationJob): Promise<ResultFinalizationIntent | null>;
  save(job: OrchestrationJob, intent: ResultFinalizationIntent): Promise<void>;
}
const coreSchema = z
  .object({
    schemaVersion: z.literal(1),
    eventId: z.uuid(),
    jobDigest: z.string().regex(/^[a-f0-9]{64}$/),
    intent: intentSchema,
  })
  .strict();
const storedSchema = coreSchema.extend({ entryHash: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const MAX_BYTES = 131_072;

/** Trusted worker-only, outside workspaces; no automatic deletion of evidence. */
export class ResultJournal implements ResultJournalPort {
  constructor(private readonly root: string) {
    if (!path.isAbsolute(root) || path.resolve(root) === path.parse(root).root)
      throw new Error("Journal requires a dedicated absolute root");
  }

  async load(payload: OrchestrationJob): Promise<ResultFinalizationIntent | null> {
    const job = orchestrationJobSchema.strict().parse(payload);
    const root = await this.ensureRoot();
    let file: Awaited<ReturnType<typeof open>>;
    try {
      file = await open(
        path.join(root, `${job.eventId}.json`),
        constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
      );
    } catch (error) {
      if (hasCode(error, "ENOENT")) return null;
      throw error;
    }
    try {
      const metadata = await file.stat();
      if (
        !metadata.isFile() ||
        metadata.size > MAX_BYTES ||
        (metadata.mode & 0o077) !== 0 ||
        metadata.uid !== process.getuid?.()
      )
        throw new Error("Unsafe journal entry");
      const bytes = await file.readFile();
      if (bytes.length > MAX_BYTES) throw new Error("Journal entry limit exceeded");
      const { entryHash, ...core } = storedSchema.parse(JSON.parse(bytes.toString("utf8")));
      if (
        entryHash !== hash(core) ||
        core.eventId !== job.eventId ||
        core.jobDigest !== hash(job) ||
        core.intent.checkpoint.baseRevision !== job.baseRevision
      )
        throw new Error("Journal integrity or job binding mismatch");
      return core.intent;
    } finally {
      await file.close();
    }
  }

  async save(payload: OrchestrationJob, input: ResultFinalizationIntent): Promise<void> {
    const job = orchestrationJobSchema.strict().parse(payload);
    const intent = intentSchema.parse(input);
    if (intent.checkpoint.baseRevision !== job.baseRevision)
      throw new Error("Journal base does not match job");
    const core = coreSchema.parse({
      schemaVersion: 1,
      eventId: job.eventId,
      jobDigest: hash(job),
      intent,
    });
    const bytes = Buffer.from(JSON.stringify({ ...core, entryHash: hash(core) }));
    if (bytes.length > MAX_BYTES) throw new Error("Journal entry limit exceeded");
    const root = await this.ensureRoot();
    const temporary = path.join(root, `${randomUUID()}.tmp`);
    const file = await open(
      temporary,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    try {
      await file.writeFile(bytes);
      await file.sync();
      await file.close();
      try {
        await link(temporary, path.join(root, `${job.eventId}.json`));
      } catch (error) {
        if (!hasCode(error, "EEXIST")) throw error;
        if (JSON.stringify(await this.load(job)) !== JSON.stringify(intent))
          throw new Error("Journal entry is immutable");
      }
      const directory = await open(
        root,
        constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
      );
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    } finally {
      await file.close().catch(() => undefined);
      await unlink(temporary);
    }
  }

  private async ensureRoot(): Promise<string> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const metadata = await lstat(this.root);
    const canonical = await realpath(this.root);
    if (
      canonical !== path.resolve(this.root) ||
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      (metadata.mode & 0o077) !== 0 ||
      metadata.uid !== process.getuid?.()
    )
      throw new Error("Journal root must be private and without symlinks");
    return canonical;
  }
}
function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
