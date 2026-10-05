import { createHash } from "node:crypto";
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import type {
  ContextBuildRequest,
  ContextBuildResult,
  ContextManifestOmission,
  ContextManifestSource,
  ContextOmissionReason,
  ContextSourceRequest,
} from "@le-fabrique/contracts";
import { contextBuildRequestSchema, contextBuildResultSchema } from "@le-fabrique/contracts";

const excludedDirectoryNames = new Set([
  ".git",
  ".next",
  "bin",
  "build",
  "coverage",
  "dist",
  "dumps",
  "node_modules",
  "obj",
  "target",
  "vendor",
]);

const secretFileNames = new Set([
  ".env",
  "auth.json",
  "credentials",
  "credentials.json",
  "id_rsa",
  "id_ed25519",
  "secrets.json",
]);

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{12,}/i,
];

interface PathInspection {
  absolutePath?: string;
  reason?: ContextOmissionReason;
}

export class ContextBuilder {
  async build(input: ContextBuildRequest): Promise<ContextBuildResult> {
    const request = contextBuildRequestSchema.parse(input);
    const workspace = await this.resolveWorkspace(request.workspacePath);
    const sources: ContextManifestSource[] = [];
    const omissions: ContextManifestOmission[] = [];
    const content: string[] = [];
    let totalBytes = 0;

    for (const source of [...request.sources].sort(compareSources)) {
      const normalizedPath = normalizeSourcePath(source.path);
      if (!normalizedPath) {
        omissions.push(omission(source, "INVALID_PATH"));
        continue;
      }
      const normalizedSource = { ...source, path: normalizedPath };
      const excludedReason = excludedPathReason(normalizedPath);
      if (excludedReason) {
        omissions.push(omission(normalizedSource, excludedReason));
        continue;
      }
      if (sources.length >= request.limits.maxFiles) {
        omissions.push(omission(normalizedSource, "FILE_LIMIT"));
        continue;
      }

      const inspected = await this.inspectPath(workspace, normalizedPath);
      if (!inspected.absolutePath) {
        omissions.push(omission(normalizedSource, inspected.reason ?? "UNREADABLE"));
        continue;
      }

      let bytes: Buffer;
      try {
        const metadata = await stat(inspected.absolutePath);
        if (!metadata.isFile()) {
          omissions.push(omission(normalizedSource, "UNREADABLE"));
          continue;
        }
        if (metadata.size > request.limits.maxFileBytes) {
          omissions.push(omission(normalizedSource, "FILE_TOO_LARGE"));
          continue;
        }
        bytes = await readFile(inspected.absolutePath);
      } catch (error) {
        omissions.push(omission(normalizedSource, fileErrorReason(error)));
        continue;
      }

      if (isBinary(bytes)) {
        omissions.push(omission(normalizedSource, "BINARY"));
        continue;
      }
      const text = bytes.toString("utf8");
      if (secretPatterns.some((pattern) => pattern.test(text))) {
        omissions.push(omission(normalizedSource, "SECRET_DETECTED"));
        continue;
      }
      if (totalBytes + bytes.byteLength > request.limits.maxTotalBytes) {
        omissions.push(omission(normalizedSource, "TOTAL_BYTES_LIMIT"));
        continue;
      }

      const sha256 = hash(bytes);
      sources.push({
        path: normalizedPath,
        role: source.role,
        sizeBytes: bytes.byteLength,
        sha256,
      });
      totalBytes += bytes.byteLength;
      content.push(`--- ${source.role}:${normalizedPath}:sha256=${sha256} ---\n${text}`);
    }

    const manifestCore = {
      schemaVersion: 1 as const,
      baseRevision: request.baseRevision,
      sources,
      omissions,
      totalBytes,
      truncated: omissions.length > 0,
    };
    return contextBuildResultSchema.parse({
      manifest: {
        ...manifestCore,
        manifestHash: hash(Buffer.from(JSON.stringify(manifestCore), "utf8")),
      },
      content: content.join("\n\n"),
    });
  }

  private async resolveWorkspace(workspacePath: string): Promise<string> {
    if (!isAbsolute(workspacePath)) throw new Error("Context workspace must be absolute");
    const workspace = await realpath(workspacePath);
    const metadata = await stat(workspace);
    if (!metadata.isDirectory()) throw new Error("Context workspace must be a directory");
    return workspace;
  }

  private async inspectPath(workspace: string, relativePath: string): Promise<PathInspection> {
    let current = workspace;
    try {
      for (const segment of relativePath.split("/")) {
        current = resolve(current, segment);
        if ((await lstat(current)).isSymbolicLink()) return { reason: "SYMLINK" };
      }
      const absolutePath = await realpath(current);
      if (!absolutePath.startsWith(`${workspace}${sep}`)) return { reason: "OUTSIDE_WORKSPACE" };
      return { absolutePath };
    } catch (error) {
      return { reason: fileErrorReason(error) };
    }
  }
}

function compareSources(left: ContextSourceRequest, right: ContextSourceRequest): number {
  if (left.path < right.path) return -1;
  if (left.path > right.path) return 1;
  if (left.role < right.role) return -1;
  if (left.role > right.role) return 1;
  return 0;
}

function normalizeSourcePath(sourcePath: string): string | null {
  if (isAbsolute(sourcePath) || sourcePath.includes("\\")) return null;
  const segments = sourcePath.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) return null;
  return segments.join("/");
}

function excludedPathReason(relativePath: string): ContextOmissionReason | null {
  const segments = relativePath.toLowerCase().split("/");
  if (segments.some((segment) => excludedDirectoryNames.has(segment))) {
    return "DEPENDENCY_OR_GENERATED";
  }
  const fileName = segments.at(-1) ?? "";
  if (
    secretFileNames.has(fileName) ||
    fileName.startsWith(".env.") ||
    fileName.endsWith(".key") ||
    fileName.endsWith(".pem")
  ) {
    return "SECRET_PATH";
  }
  return null;
}

function omission(
  source: ContextSourceRequest,
  reason: ContextOmissionReason,
): ContextManifestOmission {
  return { path: source.path, role: source.role, reason };
}

function fileErrorReason(error: unknown): ContextOmissionReason {
  return isNodeError(error) && error.code === "ENOENT" ? "MISSING" : "UNREADABLE";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function isBinary(bytes: Buffer): boolean {
  if (bytes.includes(0)) return true;
  if (bytes.byteLength === 0) return false;
  let controls = 0;
  for (const byte of bytes) {
    if (byte < 9 || (byte > 13 && byte < 32)) controls += 1;
  }
  return controls / bytes.byteLength > 0.05;
}

function hash(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
