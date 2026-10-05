import { type ChildProcess, spawn } from "node:child_process";
import type { CompleteGithubPullRequest, GithubPullRequestJob } from "@le-fabrique/contracts";
import { githubPullRequestJobSchema } from "@le-fabrique/contracts";
import type { ControlClient } from "./control-client";
import { sanitizeGithubEnvironment } from "./github-verification.processor";

type CommandResult = { exitCode: number | null; stdout: string; stderr: string };
type Runner = (
  binary: string,
  args: readonly string[],
  stdin: string | null,
) => Promise<CommandResult>;

const activeProcesses = new Set<ChildProcess>();
const permissionFilter = "{fullName: .full_name, canPush: .permissions.push}";

export function cancelGithubPullRequestProcesses(): void {
  for (const child of activeProcesses) {
    if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
    else child.kill("SIGKILL");
  }
  activeProcesses.clear();
}

export async function runGithubPullRequestCommand(
  binary: string,
  args: readonly string[],
  stdin: string | null,
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, [...args], {
      env: sanitizeGithubEnvironment(process.env),
      detached: process.platform !== "win32",
      shell: false,
      stdio: [stdin === null ? "ignore" : "pipe", "pipe", "pipe"],
    });
    activeProcesses.add(child);
    const chunks: { stdout: Buffer[]; stderr: Buffer[] } = { stdout: [], stderr: [] };
    let bytes = 0;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const stop = () => {
      if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      activeProcesses.delete(child);
      callback();
    };
    const append = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        stop();
        finish(() => reject(new Error("GitHub pull request output limit exceeded")));
        return;
      }
      target.push(chunk);
    };
    child.stdout?.on("data", (chunk: Buffer) => append(chunks.stdout, chunk));
    child.stderr?.on("data", (chunk: Buffer) => append(chunks.stderr, chunk));
    child.once("error", (error) => finish(() => reject(error)));
    child.once("close", (exitCode) =>
      finish(() =>
        resolve({
          exitCode,
          stdout: Buffer.concat(chunks.stdout).toString("utf8"),
          stderr: Buffer.concat(chunks.stderr).toString("utf8"),
        }),
      ),
    );
    if (stdin !== null && child.stdin) {
      child.stdin.on("error", () => undefined);
      child.stdin.end(stdin, "utf8");
    }
    timer = setTimeout(() => {
      stop();
      finish(() => reject(new Error("GitHub pull request command timed out")));
    }, 30_000);
    timer.unref();
  });
}

function failedResult(message: string): Omit<CompleteGithubPullRequest, "workerId"> {
  return {
    status: "FAILED",
    disposition: null,
    pullRequestNumber: null,
    pullRequestUrl: null,
    message,
  };
}

function parseObject(output: string): Record<string, unknown> {
  const value: unknown = JSON.parse(output);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected GitHub object output");
  }
  return value as Record<string, unknown>;
}

function parsePullRequestUrl(
  value: string,
  target: Pick<GithubPullRequestJob, "host" | "owner" | "repository">,
): { number: number; url: string } | null {
  try {
    const url = new URL(value.trim());
    const parts = url.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    const number = Number(parts[3]);
    if (
      url.protocol !== "https:" ||
      url.hostname.toLowerCase() !== target.host.toLowerCase() ||
      parts.length !== 4 ||
      parts[0]?.toLowerCase() !== target.owner.toLowerCase() ||
      parts[1]?.toLowerCase() !== target.repository.toLowerCase() ||
      parts[2] !== "pull" ||
      !Number.isSafeInteger(number) ||
      number < 1 ||
      url.search !== "" ||
      url.hash !== ""
    ) {
      return null;
    }
    return { number, url: url.toString() };
  } catch {
    return null;
  }
}

function parseExistingPullRequest(
  output: string,
  job: GithubPullRequestJob,
): { number: number; url: string } | null {
  const parsed: unknown = JSON.parse(output);
  if (!Array.isArray(parsed)) throw new Error("Expected GitHub pull request list");
  for (const item of parsed) {
    if (typeof item !== "object" || item === null) continue;
    const candidate = item as Record<string, unknown>;
    if (
      candidate.headRefName !== job.headBranch ||
      candidate.baseRefName !== job.baseBranch ||
      candidate.isCrossRepository !== false ||
      typeof candidate.number !== "number" ||
      typeof candidate.url !== "string"
    ) {
      continue;
    }
    const url = parsePullRequestUrl(candidate.url, job);
    if (url && url.number === candidate.number) return url;
  }
  return null;
}

async function findExistingPullRequest(
  job: GithubPullRequestJob,
  runner: Runner,
): Promise<{ number: number; url: string } | null> {
  const result = await runner(
    "gh",
    [
      "pr",
      "list",
      "--repo",
      `${job.host}/${job.owner}/${job.repository}`,
      "--head",
      job.headBranch,
      "--base",
      job.baseBranch,
      "--state",
      "open",
      "--limit",
      "10",
      "--json",
      "number,url,headRefName,baseRefName,isCrossRepository",
    ],
    null,
  );
  if (result.exitCode !== 0) throw new Error("Pull request reconciliation failed");
  return parseExistingPullRequest(result.stdout, job);
}

export async function createGithubPullRequest(
  job: GithubPullRequestJob,
  runner: Runner = runGithubPullRequestCommand,
): Promise<Omit<CompleteGithubPullRequest, "workerId">> {
  try {
    const owner = encodeURIComponent(job.owner);
    const repository = encodeURIComponent(job.repository);
    const permission = await runner(
      "gh",
      [
        "api",
        "--hostname",
        job.host,
        "--method",
        "GET",
        `repos/${owner}/${repository}`,
        "--jq",
        permissionFilter,
      ],
      null,
    );
    if (permission.exitCode !== 0)
      return failedResult("GitHub repository write permission check failed");
    const evidence = parseObject(permission.stdout);
    if (
      typeof evidence.fullName !== "string" ||
      evidence.fullName.toLowerCase() !== `${job.owner}/${job.repository}`.toLowerCase() ||
      evidence.canPush !== true
    ) {
      return failedResult("GitHub repository write permission is unavailable");
    }
    const existing = await findExistingPullRequest(job, runner);
    if (existing) {
      return {
        status: "COMPLETED",
        disposition: "EXISTING",
        pullRequestNumber: existing.number,
        pullRequestUrl: existing.url,
        message: "Existing open pull request matched the approved head and base",
      };
    }
    const args = [
      "pr",
      "create",
      "--repo",
      `${job.host}/${job.owner}/${job.repository}`,
      "--base",
      job.baseBranch,
      "--head",
      job.headBranch,
      "--title",
      job.title,
      "--body-file",
      "-",
    ];
    if (job.draft) args.push("--draft");
    const created = await runner("gh", args, job.body);
    const url = created.stdout
      .split(/\r?\n/)
      .map((line) => parsePullRequestUrl(line, job))
      .find((item) => item !== null);
    if (created.exitCode === 0 && url) {
      return {
        status: "COMPLETED",
        disposition: "CREATED",
        pullRequestNumber: url.number,
        pullRequestUrl: url.url,
        message: job.draft
          ? "Approved draft pull request created"
          : "Approved pull request created",
      };
    }
    const reconciled = await findExistingPullRequest(job, runner);
    if (reconciled) {
      return {
        status: "COMPLETED",
        disposition: "EXISTING",
        pullRequestNumber: reconciled.number,
        pullRequestUrl: reconciled.url,
        message: "Open pull request observed after an uncertain create result",
      };
    }
    return failedResult("GitHub pull request creation failed without persisted output");
  } catch {
    return failedResult("GitHub pull request creation failed without persisted output");
  }
}

export async function processGithubPullRequest(
  untrustedJob: GithubPullRequestJob,
  control: ControlClient,
  runner: Runner = runGithubPullRequestCommand,
) {
  const job = githubPullRequestJobSchema.parse(untrustedJob);
  await control.startGithubPullRequest(job.requestId);
  const result = await createGithubPullRequest(job, runner);
  return control.completeGithubPullRequest(job.requestId, result);
}
