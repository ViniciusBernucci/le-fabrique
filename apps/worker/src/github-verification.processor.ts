import { spawn } from "node:child_process";
import type { CompleteGithubVerification, GithubVerificationJob } from "@le-fabrique/contracts";
import { githubVerificationJobSchema } from "@le-fabrique/contracts";
import type { ControlClient } from "./control-client";

type CommandResult = { exitCode: number | null; stdout: string; stderr: string };
type Runner = (binary: string, args: readonly string[]) => Promise<CommandResult>;

const githubTokenVariables = new Set([
  "GH_TOKEN",
  "GITHUB_TOKEN",
  "GH_ENTERPRISE_TOKEN",
  "GITHUB_ENTERPRISE_TOKEN",
]);

export function sanitizeGithubEnvironment(source: NodeJS.ProcessEnv): Record<string, string> {
  const environment: Record<string, string> = {};
  for (const [name, value] of Object.entries(source)) {
    if (value !== undefined && !githubTokenVariables.has(name)) environment[name] = value;
  }
  environment.PATH = source.PATH ?? "/usr/local/bin:/usr/bin:/bin";
  environment.GH_PROMPT_DISABLED = "1";
  return environment;
}

export async function runGithubCommand(
  binary: string,
  args: readonly string[],
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, [...args], {
      env: sanitizeGithubEnvironment(process.env),
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: { stdout: Buffer[]; stderr: Buffer[] } = { stdout: [], stderr: [] };
    let bytes = 0;
    let settled = false;
    let timer: NodeJS.Timeout | undefined;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      callback();
    };
    const stop = () => {
      if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    };
    const append = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        stop();
        finish(() => reject(new Error("GitHub verification output limit exceeded")));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => append(chunks.stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => append(chunks.stderr, chunk));
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
    timer = setTimeout(() => {
      stop();
      finish(() => reject(new Error("GitHub verification timed out")));
    }, 15_000);
    timer.unref();
  });
}

function hasActiveAuthenticatedAccount(output: string, host: string): boolean {
  const parsed: unknown = JSON.parse(output);
  if (typeof parsed !== "object" || parsed === null || !("hosts" in parsed)) {
    throw new Error("GitHub status JSON does not contain hosts");
  }
  const hosts = (parsed as { hosts: unknown }).hosts;
  if (typeof hosts !== "object" || hosts === null) {
    throw new Error("GitHub status hosts are invalid");
  }
  const accounts = (hosts as Record<string, unknown>)[host];
  if (accounts === undefined) return false;
  if (!Array.isArray(accounts)) throw new Error("GitHub status accounts are invalid");
  return accounts.some((account) => {
    if (typeof account !== "object" || account === null) return false;
    const candidate = account as Record<string, unknown>;
    return candidate.active === true && String(candidate.state).toLowerCase() === "success";
  });
}

export async function inspectGithub(
  host: string,
  runner: Runner = runGithubCommand,
): Promise<Omit<CompleteGithubVerification, "workerId">> {
  try {
    const version = await runner("gh", ["--version"]);
    if (version.exitCode !== 0) throw new Error("GitHub CLI version failed");
    const cliVersion = version.stdout.split("\n")[0]?.trim().slice(0, 120) || null;
    if (!cliVersion) throw new Error("GitHub CLI version is empty");
    const status = await runner("gh", ["auth", "status", "--hostname", host, "--json", "hosts"]);
    const connected = hasActiveAuthenticatedAccount(status.stdout, host);
    return {
      status: "COMPLETED",
      githubState: connected ? "CONNECTED" : "AUTH_REQUIRED",
      cliVersion,
      message: connected
        ? "Authenticated GitHub CLI account observed"
        : "GitHub CLI requires authentication for the configured host",
    };
  } catch {
    return {
      status: "FAILED",
      githubState: "ERROR",
      cliVersion: null,
      message: "GitHub CLI verification failed without persisted output",
    };
  }
}

export async function processGithubVerification(
  untrustedJob: GithubVerificationJob,
  control: ControlClient,
  runner: Runner = runGithubCommand,
) {
  const job = githubVerificationJobSchema.parse(untrustedJob);
  await control.startGithubVerification(job.verificationId);
  const result = await inspectGithub(job.host, runner);
  return control.completeGithubVerification(job.verificationId, result);
}
