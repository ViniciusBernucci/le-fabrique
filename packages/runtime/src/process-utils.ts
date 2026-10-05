import { spawn } from "node:child_process";

export interface ProcessOutput {
  exitCode: number | null;
  stdout: Buffer;
  stderr: Buffer;
}

export async function runProcess(
  binary: string,
  args: readonly string[],
  options: { cwd?: string; maxBytes?: number; environment?: NodeJS.ProcessEnv } = {},
): Promise<ProcessOutput> {
  return await new Promise<ProcessOutput>((resolve, reject) => {
    const child = spawn(binary, [...args], {
      cwd: options.cwd,
      env: options.environment ?? { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let overflow = false;
    const maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
    const append = (target: Buffer[], chunk: Buffer): void => {
      bytes += chunk.byteLength;
      if (bytes > maxBytes) {
        overflow = true;
        child.kill("SIGKILL");
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => append(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => append(stderr, chunk));
    child.once("error", reject);
    child.once("close", (exitCode) => {
      if (overflow) {
        reject(new Error(`Process output exceeded ${maxBytes} bytes`));
        return;
      }
      resolve({ exitCode, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });
}

export async function runChecked(
  binary: string,
  args: readonly string[],
  options: { cwd?: string; maxBytes?: number; environment?: NodeJS.ProcessEnv } = {},
): Promise<Buffer> {
  const result = await runProcess(binary, args, options);
  if (result.exitCode !== 0) {
    const detail = result.stderr.toString("utf8").trim().slice(0, 500);
    throw new Error(
      `${binary} failed with exit code ${result.exitCode}${detail ? `: ${detail}` : ""}`,
    );
  }
  return result.stdout;
}
