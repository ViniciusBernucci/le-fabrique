import { access, mkdir, realpath, stat } from "node:fs/promises";
import { isAbsolute, resolve, sep } from "node:path";
import type { WorkspaceCreateRequest, WorkspaceCreateResult } from "@le-fabrique/contracts";
import { workspaceCreateRequestSchema, workspaceCreateResultSchema } from "@le-fabrique/contracts";
import { runChecked } from "./process-utils";

export class WorkspaceManager {
  constructor(private readonly workspaceRoot: string) {
    if (!isAbsolute(workspaceRoot)) throw new Error("Workspace root must be absolute");
  }

  async create(input: WorkspaceCreateRequest): Promise<WorkspaceCreateResult> {
    const request = workspaceCreateRequestSchema.parse(input);
    const root = await this.ensureRoot();
    const repository = await realpath(request.repositoryPath);
    if (!(await stat(repository)).isDirectory()) throw new Error("Repository must be a directory");
    const workspacePath = resolve(root, request.executionId);
    if (!workspacePath.startsWith(`${root}${sep}`)) throw new Error("Workspace escaped its root");
    await expectMissing(workspacePath);

    const revision = (
      await runChecked("/usr/bin/git", [
        "-C",
        repository,
        "rev-parse",
        "--verify",
        `${request.revision}^{commit}`,
      ])
    )
      .toString("utf8")
      .trim();
    if (!/^[0-9a-f]{40}$/.test(revision)) throw new Error("Git returned an invalid revision");

    await runChecked("/usr/bin/git", [
      "-C",
      repository,
      "worktree",
      "add",
      "--detach",
      workspacePath,
      revision,
    ]);
    const actualRevision = (
      await runChecked("/usr/bin/git", ["-C", workspacePath, "rev-parse", "HEAD"])
    )
      .toString("utf8")
      .trim();
    return workspaceCreateResultSchema.parse({
      executionId: request.executionId,
      workspacePath,
      revision: actualRevision,
      detached: true,
    });
  }

  private async ensureRoot(): Promise<string> {
    await mkdir(this.workspaceRoot, { recursive: true, mode: 0o700 });
    return await realpath(this.workspaceRoot);
  }
}

async function expectMissing(path: string): Promise<void> {
  try {
    await access(path);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("Workspace already exists");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
