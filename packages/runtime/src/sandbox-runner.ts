import { spawn } from "node:child_process";
import { lstat, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import type { SandboxCommandRequest, SandboxCommandResult } from "@le-fabrique/contracts";
import { sandboxCommandRequestSchema, sandboxCommandResultSchema } from "@le-fabrique/contracts";
import { runProcess } from "./process-utils";

const allowedEnvironmentNames = new Set(["CI", "LANG", "LC_ALL", "NODE_ENV", "TZ"]);

export interface SandboxRunnerOptions {
  systemdRunPath?: string;
  systemctlPath?: string;
  unsharePath?: string;
  launcherPath?: string;
  now?: () => Date;
  killGraceMs?: number;
}

export class SandboxRunner {
  private readonly systemdRunPath: string;
  private readonly systemctlPath: string;
  private readonly unsharePath: string;
  private readonly launcherPath: string;
  private readonly now: () => Date;
  private readonly killGraceMs: number;
  private active = false;

  constructor(options: SandboxRunnerOptions = {}) {
    this.systemdRunPath = options.systemdRunPath ?? "/usr/bin/systemd-run";
    this.systemctlPath = options.systemctlPath ?? "/usr/bin/systemctl";
    this.unsharePath = options.unsharePath ?? "/usr/bin/unshare";
    this.launcherPath = options.launcherPath ?? resolve(__dirname, "sandbox-launcher.cjs");
    this.now = options.now ?? (() => new Date());
    this.killGraceMs = options.killGraceMs ?? 200;
  }

  async execute(input: SandboxCommandRequest): Promise<SandboxCommandResult> {
    const request = sandboxCommandRequestSchema.parse(input);
    if (this.active) throw new Error("SandboxRunner already has an active command");
    if (!isAbsolute(request.command)) throw new Error("Sandbox command must be absolute");
    for (const key of Object.keys(request.environment)) {
      if (!allowedEnvironmentNames.has(key))
        throw new Error(`Sandbox environment key denied: ${key}`);
    }
    const workspace = await realpath(request.workspacePath);
    if (!(await stat(workspace)).isDirectory())
      throw new Error("Sandbox workspace must be a directory");
    await validateWritablePaths(workspace, request.writablePaths);
    const startedAt = this.now().toISOString();
    const unitName = `le-fabrique-${request.executionId.replaceAll("-", "")}.service`;
    const environment = Buffer.from(JSON.stringify(request.environment), "utf8").toString(
      "base64url",
    );
    const writablePaths = Buffer.from(JSON.stringify(request.writablePaths), "utf8").toString(
      "base64url",
    );
    const args = [
      "--user",
      "--wait",
      "--pipe",
      "--collect",
      "--quiet",
      `--unit=${unitName}`,
      "--property=Type=exec",
      `--property=MemoryMax=${request.limits.memoryBytes}`,
      `--property=CPUQuota=${request.limits.cpuQuotaPercent}%`,
      `--property=TasksMax=${request.limits.maxProcesses}`,
      "--property=KillMode=control-group",
      "--property=TimeoutStopSec=2s",
      `--property=RuntimeMaxSec=${Math.ceil(request.limits.timeoutMs / 1000) + 5}s`,
      this.unsharePath,
      "--user",
      "--map-root-user",
      "--mount",
      "--net",
      "--pid",
      "--fork",
      "--mount-proc",
      process.execPath,
      this.launcherPath,
      workspace,
      String(request.limits.maxOpenFiles),
      String(request.limits.maxFileBytes),
      environment,
      writablePaths,
      "--",
      request.command,
      ...request.args,
    ];
    this.active = true;
    try {
      return await this.runUnit(request, unitName, args, startedAt);
    } finally {
      this.active = false;
    }
  }

  private async runUnit(
    request: SandboxCommandRequest,
    unitName: string,
    args: string[],
    startedAt: string,
  ): Promise<SandboxCommandResult> {
    return await new Promise<SandboxCommandResult>((resolvePromise, reject) => {
      const child = spawn(this.systemdRunPath, args, {
        env: controlEnvironment(),
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      let stderr: Buffer<ArrayBufferLike> = Buffer.alloc(0);
      let reason: "timeout" | "log-limit" | null = null;
      let terminating = false;
      const terminate = async (nextReason: "timeout" | "log-limit"): Promise<void> => {
        if (terminating) return;
        terminating = true;
        reason = nextReason;
        await this.signalUnit(unitName, "SIGTERM");
        await delay(this.killGraceMs);
        await this.signalUnit(unitName, "SIGKILL");
      };
      const append = (current: Buffer, chunk: Buffer): Buffer => {
        const remaining = request.limits.maxLogBytes - stdout.byteLength - stderr.byteLength;
        if (remaining <= 0) {
          void terminate("log-limit");
          return current;
        }
        const accepted = chunk.subarray(0, remaining);
        if (accepted.byteLength < chunk.byteLength) void terminate("log-limit");
        return Buffer.concat([current, accepted]);
      };
      child.stdout.on("data", (chunk: Buffer) => {
        stdout = append(stdout, chunk);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr = append(stderr, chunk);
      });
      child.once("error", reject);
      const timeout = setTimeout(() => void terminate("timeout"), request.limits.timeoutMs);
      timeout.unref();
      child.once("close", async (exitCode) => {
        clearTimeout(timeout);
        const stoppedConfirmed = await this.isStopped(unitName);
        const status =
          reason === "timeout"
            ? "TIMED_OUT"
            : reason === "log-limit"
              ? "LOG_LIMIT"
              : exitCode === 0
                ? "COMPLETED"
                : "FAILED";
        resolvePromise(
          sandboxCommandResultSchema.parse({
            schemaVersion: 1,
            executionId: request.executionId,
            unitName,
            status,
            exitCode,
            stdout: stdout.toString("utf8"),
            stderr: stderr.toString("utf8"),
            startedAt,
            finishedAt: this.now().toISOString(),
            stoppedConfirmed,
          }),
        );
      });
    });
  }

  private async signalUnit(unitName: string, signal: "SIGTERM" | "SIGKILL"): Promise<void> {
    await runProcess(
      this.systemctlPath,
      ["--user", "kill", "--kill-who=all", `--signal=${signal}`, unitName],
      { environment: controlEnvironment() },
    ).catch(() => undefined);
  }

  private async isStopped(unitName: string): Promise<boolean> {
    const result = await runProcess(this.systemctlPath, ["--user", "is-active", unitName], {
      environment: controlEnvironment(),
    }).catch(() => null);
    return result?.exitCode !== 0 || result.stdout.toString("utf8").trim() !== "active";
  }
}

async function validateWritablePaths(
  workspace: string,
  writablePaths: readonly string[],
): Promise<void> {
  for (const writablePath of writablePaths) {
    const segments = writablePath.split("/");
    const candidate = resolve(workspace, ...segments);
    const relativePath = relative(workspace, candidate);
    if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("Sandbox writable path must remain inside the workspace");
    }
    let current = workspace;
    for (const [index, segment] of segments.entries()) {
      current = resolve(current, segment);
      const details = await lstat(current).catch(() => null);
      if (!details) throw new Error(`Sandbox writable path does not exist: ${writablePath}`);
      if (details.isSymbolicLink())
        throw new Error(`Sandbox writable path contains a symbolic link: ${writablePath}`);
      if (index < segments.length - 1 && !details.isDirectory()) {
        throw new Error(`Sandbox writable path parent is not a directory: ${writablePath}`);
      }
    }
  }
}

async function delay(milliseconds: number): Promise<void> {
  await new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

function controlEnvironment(): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
    XDG_RUNTIME_DIR: process.env.XDG_RUNTIME_DIR,
  };
}
