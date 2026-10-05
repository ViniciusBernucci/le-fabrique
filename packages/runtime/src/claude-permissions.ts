import { lstat, realpath } from "node:fs/promises";
import path from "node:path";
import type { RuntimeExecutionRequest } from "@le-fabrique/contracts";

export const CLAUDE_CONFINEMENT_POLICY = "claude-granular-v1";

/** Edit rules cover both Edit and Write. dontAsk denies writes without an explicit allow. */
export async function claudePermissionSettings(request: RuntimeExecutionRequest) {
  const workspace = await realpath(request.workspacePath);
  const allow: string[] = [];
  if (request.permissionMode === "WORKSPACE_WRITE") {
    if (request.writablePaths.length === 0)
      throw new Error("Explicit Claude writable paths required");
    for (const relative of request.writablePaths) {
      const target = path.resolve(workspace, relative);
      if (
        !target.startsWith(`${workspace}${path.sep}`) ||
        /[\r\n\0()*?![\]\\]/.test(target) ||
        (await realpath(target)) !== target
      )
        throw new Error("Claude writable path is unsafe or unsupported");
      const metadata = await lstat(target);
      if (metadata.isSymbolicLink() || (!metadata.isFile() && !metadata.isDirectory()))
        throw new Error("Unsupported writable entry");
      const absolute = `/${target}`;
      allow.push(`Edit(${absolute})`);
      if (metadata.isDirectory()) allow.push(`Edit(${absolute}/**)`);
    }
  }
  return {
    permissions: {
      defaultMode: "dontAsk",
      disableBypassPermissionsMode: "disable",
      disableAutoMode: "disable",
      allow,
      deny: [
        "Bash",
        "PowerShell",
        "REPL",
        "Agent",
        "WebFetch",
        "WebSearch",
        "NotebookEdit",
        ...[".git", ".codex", ".claude"].flatMap((name) => [
          `Read(**/${name})`,
          `Read(**/${name}/**)`,
          `Edit(**/${name})`,
          `Edit(**/${name}/**)`,
        ]),
      ],
    },
  };
}

export type ClaudePermissionObservation =
  | { kind: "attempt"; id: string; name: string; path: string }
  | { kind: "result"; id: string; denied: boolean; error: boolean };
