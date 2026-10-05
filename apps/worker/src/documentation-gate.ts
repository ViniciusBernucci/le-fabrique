import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type {
  DeveloperWorkflowRequest,
  WorkflowCheckObservation,
  WorkflowDocumentationEvidence,
} from "@le-fabrique/contracts";

const exec = promisify(execFile);
const MAX_FILE_BYTES = 262_144;

/** Trusted supervisor, after all writers/checks have stopped; never follows repository symlinks. */
export async function checkDocumentation(
  request: DeveloperWorkflowRequest,
  workspacePath: string,
  snapshotHash: string,
  checks: WorkflowCheckObservation[],
): Promise<WorkflowDocumentationEvidence> {
  if (!request.documentation) throw new Error("Documentation policy is required");
  const workspace = await realpath(workspacePath);
  const gitOptions = {
    cwd: workspace,
    timeout: 10_000,
    maxBuffer: 1_048_576,
    encoding: "utf8" as const,
    env: { PATH: "/usr/bin:/bin", GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
  };
  const diff = await exec(
    "/usr/bin/git",
    [
      "-c",
      "core.fsmonitor=false",
      "diff",
      "--no-ext-diff",
      "--name-only",
      "-z",
      request.baseRevision,
      "--",
    ],
    gitOptions,
  );
  const untracked = await exec(
    "/usr/bin/git",
    ["-c", "core.fsmonitor=false", "ls-files", "--others", "--exclude-standard", "-z"],
    gitOptions,
  );
  const changed = new Set([...diff.stdout.split("\0"), ...untracked.stdout.split("\0")]);
  const findings = new Set<WorkflowDocumentationEvidence["findings"][number]>();
  const files: WorkflowDocumentationEvidence["files"] = [];
  for (const relative of request.documentation.requiredFiles) {
    let bytes: Buffer;
    try {
      bytes = await readDocument(workspace, relative);
    } catch {
      findings.add("MISSING_OR_UNSAFE");
      continue;
    }
    files.push({ path: relative, sha256: createHash("sha256").update(bytes).digest("hex") });
    if (!changed.has(relative)) findings.add("UNCHANGED");
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      findings.add("MISSING_OR_UNSAFE");
      continue;
    }
    if (/\b(?:TODO|TBD|FIXME)\b|AAAA-MM-DD|A DEFINIR|<preencher>/i.test(text))
      findings.add("PLACEHOLDER");
    if (relative !== request.documentation.reportPath) continue;
    const lines = text.split(/\r?\n/);
    for (const section of request.documentation.requiredSections) {
      const index = lines.findIndex(
        (line) =>
          /^#{1,6}\s+/.test(line) &&
          line
            .replace(/^#{1,6}\s+/, "")
            .replace(/\s+#+\s*$/, "")
            .trim() === section,
      );
      let body = "";
      if (index >= 0) {
        for (let i = index + 1; i < lines.length && !/^#{1,6}\s+/.test(lines[i] ?? ""); i += 1)
          body += lines[i]?.trim() ?? "";
      }
      if (!body) findings.add("INCOMPLETE_SECTIONS");
    }
    if (!text.includes(request.baseRevision)) findings.add("MISSING_REVISION");
    if (!checks.every((check) => text.includes(check.name))) findings.add("MISSING_CHECKS");
  }
  return { status: findings.size ? "FAIL" : "PASS", snapshotHash, files, findings: [...findings] };
}

async function readDocument(workspace: string, relative: string): Promise<Buffer> {
  const target = path.resolve(workspace, relative);
  if (!target.startsWith(`${workspace}${path.sep}`) || (await realpath(target)) !== target)
    throw new Error("Unsafe document path");
  const handle = await open(
    target,
    constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
  );
  try {
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size === 0 || metadata.size > MAX_FILE_BYTES)
      throw new Error("Invalid document size/type");
    const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const result = await handle.read(buffer, size, buffer.length - size, size);
      if (!result.bytesRead) break;
      size += result.bytesRead;
    }
    if (size > MAX_FILE_BYTES || size !== metadata.size)
      throw new Error("Document changed during read");
    return buffer.subarray(0, size);
  } finally {
    await handle.close();
  }
}
