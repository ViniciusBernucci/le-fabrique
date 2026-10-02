import { lstat, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export async function validateWorkspaceWritablePaths(
  workspace: string,
  writablePaths: readonly string[],
): Promise<void> {
  const workspaceMetadata = await stat(workspace).catch(() => null);
  if (!workspaceMetadata?.isDirectory()) throw new Error("Writable workspace is unavailable");

  for (const writablePath of writablePaths) {
    const segments = writablePath.split("/");
    if (
      segments.some(
        (segment) =>
          !segment ||
          segment === "." ||
          segment === ".." ||
          segment === ".git" ||
          segment === ".codex",
      )
    ) {
      throw new Error("Writable path is invalid");
    }
    const candidate = resolve(workspace, ...segments);
    const relativePath = relative(workspace, candidate);
    if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("Writable path must remain inside the workspace");
    }

    let current = workspace;
    for (const [index, segment] of segments.entries()) {
      current = resolve(current, segment);
      const details = await lstat(current).catch(() => null);
      if (!details) throw new Error("Writable path does not exist");
      if (details.isSymbolicLink()) throw new Error("Writable path contains a symbolic link");
      if (index < segments.length - 1 && !details.isDirectory()) {
        throw new Error("Writable path parent must be a directory");
      }
    }
  }
}
