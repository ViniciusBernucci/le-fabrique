import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ARTIFACT_RAW_MAX_BYTES, executionArtifactSchema, verifyExecutionArtifact } from "./index";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
function bundle(
  patch = "diff --git a/src/a.ts b/src/a.ts\n+const a = 1;\n",
  filePath = "src/new.ts",
  content = "export const b = 2;\n",
) {
  const patchBytes = Buffer.from(patch);
  const bytes = Buffer.from(content);
  const core = {
    schemaVersion: 1,
    snapshotId: crypto.randomUUID(),
    baseRevision: "a".repeat(40),
    headRevision: "a".repeat(40),
    patchBytes: patchBytes.length,
    patchSha256: hash(patchBytes),
    untracked: [{ path: filePath, sizeBytes: bytes.length, mode: 0o644, sha256: hash(bytes) }],
    totalArtifactBytes: patchBytes.length + bytes.length,
    createdAt: new Date().toISOString(),
  };
  return executionArtifactSchema.parse({
    schemaVersion: 1,
    manifest: { ...core, manifestHash: hash(Buffer.from(JSON.stringify(core))) },
    patchBase64: patchBytes.toString("base64"),
    files: [{ path: filePath, dataBase64: bytes.toString("base64") }],
  });
}
const verify = (artifact: ReturnType<typeof bundle>) =>
  verifyExecutionArtifact(artifact, (encoded) => Buffer.from(encoded, "base64"), hash);
describe("execution artifact contract", () => {
  it("preserves patch/file bytes and verifies all digests", () => {
    expect(() => verify(bundle())).not.toThrow();
  });
  it("rejects traversal, absolute paths and noncanonical base64", () => {
    for (const filePath of [
      "../private",
      "/home/private",
      "src/../private",
      "C:/private",
      "src\\private",
      "src/\0private",
    ])
      expect(() => bundle("", filePath)).toThrow();
    expect(() => executionArtifactSchema.parse({ ...bundle(), patchBase64: "Zh==" })).toThrow();
  });
  it.each(["patch", "file", "manifest", "missing"])("rejects %s corruption", (mode) => {
    const artifact = bundle();
    if (mode === "patch") artifact.patchBase64 = Buffer.from("altered").toString("base64");
    if (mode === "file") artifact.files[0].dataBase64 = Buffer.from("altered").toString("base64");
    if (mode === "manifest") artifact.manifest.manifestHash = "f".repeat(64);
    if (mode === "missing") artifact.files = [];
    expect(() => verify(artifact)).toThrow();
  });
  it("blocks known secrets without changing the patch or hashes", () => {
    expect(() => verify(bundle("+sk-synthetic1234567890"))).toThrow("sensitive");
    expect(() => verify(bundle("diff --git a/.env b/.env\n+VALUE=private"))).toThrow(
      "Sensitive tracked",
    );
    expect(() => verify(bundle("", "auth.json"))).toThrow("Sensitive artifact path");
  });
  it("rejects unknown fields and oversized JSON", () => {
    expect(() =>
      executionArtifactSchema.parse({ ...bundle(), workspacePath: "/private" }),
    ).toThrow();
    expect(() => bundle("x".repeat(ARTIFACT_RAW_MAX_BYTES + 1))).toThrow("delivery limit");
  });
  it("delivers a multi-megabyte binary untracked file with exact hashes", () => {
    const artifact = bundle(
      "x".repeat(1024 * 1024),
      "src/asset.bin",
      "\u0000\u00ff".repeat(512 * 1024),
    );
    expect(new TextEncoder().encode(JSON.stringify(artifact)).length).toBeGreaterThan(65_536);
    expect(() => verify(artifact)).not.toThrow();
  });
  it("retains the encoded JSON limit even when raw bytes fit", () => {
    expect(() => bundle("x".repeat(ARTIFACT_RAW_MAX_BYTES - 10), "src/new.ts", "")).toThrow(
      "8 MiB",
    );
  });
});
