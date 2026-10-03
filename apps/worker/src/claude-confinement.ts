import { createHash } from "node:crypto";
import { constants, createReadStream } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { CLAUDE_CONFINEMENT_POLICY, type ClaudePermissionObservation } from "@le-fabrique/runtime";
import { z } from "zod";

export const claudeConfinementProofSchema = z
  .object({
    schemaVersion: z.literal(1),
    policy: z.literal(CLAUDE_CONFINEMENT_POLICY),
    installationId: z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}$/),
    uid: z.number().int().nonnegative(),
    binarySha256: z.string().regex(/^[a-f0-9]{64}$/),
    cliVersion: z.string().regex(/^2\.1\.285 \(Claude Code\)$/),
    verifiedAt: z.iso.datetime(),
    subscriptionOnlyConfirmed: z.literal(true),
    permittedWrite: z.literal(true),
    permittedEdit: z.literal(true),
    deniedCases: z.array(z.string()).min(1).max(30),
  })
  .strict();

export const CLAUDE_DENIED_CASES = [
  "scope-write",
  "scope-edit",
  "outside-write",
  "outside-edit",
  "symlink-write",
  "symlink-edit",
  "git-write",
  "git-edit",
  "codex-write",
  "codex-edit",
  "claude-write",
  "claude-edit",
  "outside-read",
  "symlink-read",
] as const;

/** A completed turn or model claim is insufficient: correlate native attempted tool calls and denials. */
export function nativePermissionDenied(
  observations: ClaudePermissionObservation[],
  tool: string,
  file: string,
): boolean {
  const matching = observations.filter(
    (entry) => entry.kind === "attempt" && entry.name === tool && entry.path === file,
  );
  return (
    matching.length > 0 &&
    matching.every((attempt) => {
      const results = observations.filter(
        (entry) => entry.kind === "result" && entry.id === attempt.id,
      );
      const result = results[0];
      return results.length === 1 && result?.kind === "result" && result.denied && result.error;
    })
  );
}
export function nativePermissionSucceeded(
  observations: ClaudePermissionObservation[],
  tool: string,
  file: string,
): boolean {
  return observations.some(
    (entry) =>
      entry.kind === "attempt" &&
      entry.name === tool &&
      entry.path === file &&
      observations.some(
        (result) =>
          result.kind === "result" && result.id === entry.id && !result.error && !result.denied,
      ),
  );
}

export async function cliFingerprint(binaryPath: string): Promise<string> {
  const resolved = await realpath(binaryPath);
  const metadata = await stat(resolved);
  if (!metadata.isFile() || metadata.size > 536_870_912) throw new Error("Unsupported CLI binary");
  const hash = createHash("sha256");
  for await (const bytes of createReadStream(resolved)) hash.update(bytes);
  return hash.digest("hex");
}

export async function requireClaudeConfinementProof(
  root: string,
  installationId: string,
  binaryPath: string,
) {
  const file = path.join(root, `claude-${installationId}`, "confinement.json");
  try {
    if ((await realpath(file)) !== file) throw new Error("Symlink proof");
    const metadata = await lstat(file);
    if (
      !metadata.isFile() ||
      metadata.uid !== process.getuid?.() ||
      (metadata.mode & 0o077) !== 0 ||
      metadata.size > 65_536
    )
      throw new Error("Unsafe proof");
    const handle = await open(
      file,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK,
    );
    let proof: z.infer<typeof claudeConfinementProofSchema>;
    try {
      const buffer = Buffer.alloc(65_537);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead !== metadata.size) throw new Error("Changed proof");
      proof = claudeConfinementProofSchema.parse(
        JSON.parse(buffer.subarray(0, bytesRead).toString("utf8")),
      );
    } finally {
      await handle.close();
    }
    const age = Date.now() - Date.parse(proof.verifiedAt);
    if (
      proof.installationId !== installationId ||
      proof.uid !== process.getuid?.() ||
      age < -5_000 ||
      age > 7 * 86_400_000 ||
      proof.binarySha256 !== (await cliFingerprint(binaryPath)) ||
      JSON.stringify([...proof.deniedCases].sort()) !==
        JSON.stringify([...CLAUDE_DENIED_CASES].sort())
    )
      throw new Error("Stale or incomplete proof");
    return proof;
  } catch {
    throw new Error("Claude writing requires current verified granular confinement proof");
  }
}
