import { spawn } from "node:child_process";
import type {
  CompleteProviderVerification,
  ProviderVerificationJob,
  SettingsProvider,
} from "@le-fabrique/contracts";
import {
  classifyClaudeSubscriptionStatus,
  sanitizeSubscriptionEnvironment,
} from "@le-fabrique/runtime";
import type { ControlClient } from "./control-client";

type CommandResult = { exitCode: number | null; stdout: string; stderr: string };
type Runner = (binary: string, args: readonly string[]) => Promise<CommandResult>;

const profiles: Record<
  SettingsProvider,
  { binary: string; versionArgs: string[]; statusArgs: string[] }
> = {
  CODEX: { binary: "codex", versionArgs: ["--version"], statusArgs: ["login", "status"] },
  CLAUDE: {
    binary: "claude",
    versionArgs: ["--version"],
    statusArgs: ["auth", "status", "--json"],
  },
  ANTIGRAVITY: { binary: "agy", versionArgs: ["--version"], statusArgs: ["models"] },
};

export async function runVerificationCommand(
  binary: string,
  args: readonly string[],
): Promise<CommandResult> {
  return await new Promise((resolve, reject) => {
    const environment = sanitizeSubscriptionEnvironment(process.env).environment;
    const child = spawn(binary, [...args], {
      env: { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin", ...environment },
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: { stdout: Buffer[]; stderr: Buffer[] } = { stdout: [], stderr: [] };
    let bytes = 0;
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const append = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
        finish(() => reject(new Error("Verification output limit exceeded")));
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
    const timer = setTimeout(() => {
      if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
      finish(() => reject(new Error("Verification timed out")));
    }, 15_000);
    timer.unref();
  });
}

export async function inspectProvider(
  provider: SettingsProvider,
  runner: Runner = runVerificationCommand,
): Promise<Omit<CompleteProviderVerification, "workerId">> {
  const profile = profiles[provider];
  try {
    const version = await runner(profile.binary, profile.versionArgs);
    const status = await runner(profile.binary, profile.statusArgs);
    const cliVersion = version.exitCode === 0 ? version.stdout.trim().slice(0, 120) || null : null;
    if (provider === "CLAUDE" && status.exitCode === 0) {
      const providerState = classifyClaudeSubscriptionStatus(JSON.parse(status.stdout));
      return {
        status: "COMPLETED",
        providerState,
        cliVersion,
        observedModels: [],
        message:
          providerState === "AVAILABLE"
            ? "Authenticated subscription client observed"
            : providerState === "AUTH_REQUIRED"
              ? "Official client requires authentication"
              : "Client authentication mode is not subscription eligible",
      };
    }
    if (
      status.exitCode !== 0 ||
      /not logged|not authenticated|login required|please sign in|requires authentication/i.test(
        `${status.stdout}\n${status.stderr}`,
      )
    ) {
      return {
        status: "COMPLETED",
        providerState: "AUTH_REQUIRED",
        cliVersion,
        observedModels: [],
        message: "Official client requires authentication",
      };
    }
    const observedModels =
      provider === "ANTIGRAVITY"
        ? status.stdout
            .split("\n")
            .map((line) => line.trim())
            .filter((line) => /^[a-zA-Z0-9][a-zA-Z0-9._/-]{1,119}$/.test(line))
            .slice(0, 50)
        : [];
    return {
      status: "COMPLETED",
      providerState: "AVAILABLE",
      cliVersion,
      observedModels,
      message: "Authenticated subscription client observed",
    };
  } catch {
    return {
      status: "FAILED",
      providerState: "ERROR",
      cliVersion: null,
      observedModels: [],
      message: "Client verification failed without persisted output",
    };
  }
}

export async function processProviderVerification(
  job: ProviderVerificationJob,
  control: ControlClient,
  runner: Runner = runVerificationCommand,
) {
  await control.startProviderVerification(job.verificationId);
  const result = await inspectProvider(job.provider, runner);
  return control.completeProviderVerification(job.verificationId, result);
}
