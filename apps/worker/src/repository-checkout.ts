import { spawn } from "node:child_process";
import { lstat, mkdir, mkdtemp, open, realpath, rename, rm, unlink } from "node:fs/promises";
import path from "node:path";
import { inspectGithubCredentialStorage } from "./github-onboarding.processor";
import { sanitizeGithubEnvironment } from "./github-verification.processor";

const commandTimeoutMs = 5 * 60 * 1000;
const commandOutputLimitBytes = 64 * 1024;
const tokenOutputLimitBytes = 8 * 1024;

export type CheckoutCommandResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

export type CheckoutCommandRunner = (
  binary: string,
  args: readonly string[],
  options: {
    cwd: string;
    environment: Record<string, string>;
    timeoutMs: number;
    maxOutputBytes: number;
    signal?: AbortSignal;
  },
) => Promise<CheckoutCommandResult>;

export type RepositoryCheckoutInput = {
  projectId: string;
  workflowId: string;
  repositoryUrl: string;
  baseRevision: string;
};

export type RepositoryCheckoutConfig = {
  root: string | undefined;
  allowedHosts: readonly string[];
};

export type PreparedRepositoryCheckout = {
  path: string;
  projectId: string;
  workflowId: string;
  repositoryUrl: string;
  baseRevision: string;
};

function validateRepositoryUrl(repositoryUrl: string, allowedHosts: readonly string[]): URL {
  let parsed: URL;
  try {
    parsed = new URL(repositoryUrl);
  } catch {
    throw new Error("Repository URL is invalid");
  }
  const host = parsed.hostname.toLowerCase();
  const encodedSegments = parsed.pathname.split("/").slice(1);
  const pathSegments = encodedSegments.filter(Boolean);
  const safePath =
    parsed.pathname.startsWith("/") &&
    !parsed.pathname.includes("//") &&
    pathSegments.length >= 2 &&
    pathSegments.every((segment) => {
      try {
        const decoded = decodeURIComponent(segment);
        return (
          decoded !== "." &&
          decoded !== ".." &&
          !decoded.includes("/") &&
          !decoded.includes("\\") &&
          ![...decoded].some((character) => {
            const code = character.charCodeAt(0);
            return code < 0x20 || code === 0x7f;
          })
        );
      } catch {
        return false;
      }
    });
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.port ||
    !allowedHosts.map((item) => item.toLowerCase()).includes(host) ||
    !safePath
  ) {
    throw new Error("Repository URL is not eligible for trusted checkout");
  }
  return parsed;
}

function validateCheckoutInput(input: RepositoryCheckoutInput): void {
  if (!zUuid(input.projectId) || !zUuid(input.workflowId)) {
    throw new Error("Checkout project and workflow IDs must be UUIDs");
  }
  if (!/^[0-9a-f]{40}$/.test(input.baseRevision)) {
    throw new Error("Checkout requires an exact lowercase commit SHA");
  }
}

function zUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateRoot(root: string | undefined): string {
  if (!root || !path.isAbsolute(root)) {
    throw new Error("Trusted checkout root must be configured as an absolute path");
  }
  const resolved = path.resolve(root);
  if (resolved === path.parse(resolved).root) {
    throw new Error("Trusted checkout root cannot be a filesystem root");
  }
  return resolved;
}

async function ensurePrivateOwnedDirectory(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const metadata = await lstat(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error("Trusted checkout directory must not be a symbolic link");
  }
  if ((metadata.mode & 0o077) !== 0) {
    throw new Error("Trusted checkout directory permissions must be 0700");
  }
  if (typeof process.getuid === "function" && metadata.uid !== process.getuid()) {
    throw new Error("Trusted checkout directory must be owned by the worker identity");
  }
  if ((await realpath(directory)) !== path.resolve(directory)) {
    throw new Error("Trusted checkout directory cannot traverse symbolic-link ancestors");
  }
}

export async function runCheckoutCommand(
  binary: string,
  args: readonly string[],
  options: {
    cwd: string;
    environment: Record<string, string>;
    timeoutMs: number;
    maxOutputBytes: number;
    signal?: AbortSignal;
  },
): Promise<CheckoutCommandResult> {
  return await new Promise((resolve, reject) => {
    if (options.signal?.aborted) return reject(new Error(`${binary} was canceled`));
    const child = spawn(binary, [...args], {
      cwd: options.cwd,
      env: options.environment,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: { stdout: Buffer[]; stderr: Buffer[] } = { stdout: [], stderr: [] };
    let bytes = 0;
    let timedOut = false;
    let oversized = false;
    let canceled = false;
    let timer: NodeJS.Timeout;
    const terminate = () => {
      if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    };
    const append = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > options.maxOutputBytes) {
        oversized = true;
        terminate();
        return;
      }
      target.push(chunk);
    };
    child.stdout.on("data", (chunk: Buffer) => append(chunks.stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => append(chunks.stderr, chunk));
    child.once("error", () => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      reject(new Error(`${binary} could not start`));
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      if (canceled) return reject(new Error(`${binary} was canceled`));
      if (timedOut) return reject(new Error(`${binary} timed out`));
      if (oversized) return reject(new Error(`${binary} output limit exceeded`));
      resolve({
        exitCode,
        stdout: Buffer.concat(chunks.stdout).toString("utf8"),
        stderr: Buffer.concat(chunks.stderr).toString("utf8"),
      });
    });
    timer = setTimeout(() => {
      timedOut = true;
      terminate();
    }, options.timeoutMs);
    const cancel = () => {
      canceled = true;
      terminate();
    };
    options.signal?.addEventListener("abort", cancel, { once: true });
    timer.unref();
  });
}

function assertCommandSucceeded(result: CheckoutCommandResult, stage: string): void {
  if (result.exitCode !== 0) {
    // Do not surface Git output: it may contain private repository metadata.
    throw new Error(`Trusted repository checkout failed during ${stage}`);
  }
}

async function readGithubToken(
  host: string,
  runner: CheckoutCommandRunner,
  signal?: AbortSignal,
): Promise<string> {
  const environment = sanitizeGithubEnvironment(process.env);
  const ghEnvironment = {
    PATH: environment.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: environment.HOME ?? "/var/empty",
    ...(environment.GH_CONFIG_DIR ? { GH_CONFIG_DIR: environment.GH_CONFIG_DIR } : {}),
    ...Object.fromEntries(
      [
        "DBUS_SESSION_BUS_ADDRESS",
        "XDG_RUNTIME_DIR",
        "XDG_CONFIG_HOME",
        "XDG_DATA_HOME",
        "GPG_AGENT_INFO",
      ].flatMap((name) => (environment[name] ? [[name, environment[name] as string]] : [])),
    ),
    GH_HOST: host,
    GH_PROMPT_DISABLED: "1",
  };
  const runGithub = (args: readonly string[]) =>
    runner("gh", args, {
      cwd: process.cwd(),
      environment: ghEnvironment,
      timeoutMs: 15_000,
      maxOutputBytes: tokenOutputLimitBytes,
      signal,
    });
  const storage = await inspectGithubCredentialStorage(host, (binary, args) =>
    runner(binary, args, {
      cwd: process.cwd(),
      environment: ghEnvironment,
      timeoutMs: 15_000,
      maxOutputBytes: tokenOutputLimitBytes,
      signal,
    }),
  );
  if (
    storage.status !== "COMPLETED" ||
    storage.githubState !== "CONNECTED" ||
    storage.credentialStorage !== "SECURE_STORE"
  ) {
    throw new Error("Trusted repository checkout requires secure official GitHub authentication");
  }
  const result = await runGithub(["auth", "token", "--hostname", host]);
  if (result.exitCode !== 0) {
    throw new Error("Trusted repository checkout could not obtain official GitHub authentication");
  }
  const token = result.stdout.trim();
  if (!token || /[\r\n\0]/.test(token)) {
    throw new Error("Trusted repository checkout did not receive a usable official credential");
  }
  return token;
}

function gitEnvironment(host: string, token: string): Record<string, string> {
  const safeEnvironment: Record<string, string> = {
    PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
    HOME: process.env.HOME ?? "/var/empty",
    LANG: "C.UTF-8",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_ATTR_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    GIT_LFS_SKIP_SMUDGE: "1",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_PROTOCOL_FROM_USER: "0",
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `http.https://${host}/.extraHeader`,
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString("base64")}`,
  };
  return safeEnvironment;
}

const gitSafetyArgs = [
  "-c",
  "core.hooksPath=/dev/null",
  "-c",
  "protocol.https.allow=always",
  "-c",
  "protocol.file.allow=never",
  "-c",
  "protocol.ext.allow=never",
  "-c",
  "protocol.allow=never",
];

export async function prepareRepositoryCheckout(
  input: RepositoryCheckoutInput,
  config: RepositoryCheckoutConfig,
  runner: CheckoutCommandRunner = runCheckoutCommand,
  signal?: AbortSignal,
): Promise<PreparedRepositoryCheckout> {
  validateCheckoutInput(input);
  const root = validateRoot(config.root);
  const repository = validateRepositoryUrl(input.repositoryUrl, config.allowedHosts);
  await ensurePrivateOwnedDirectory(root);

  const projectRoot = path.join(root, input.projectId);
  await ensurePrivateOwnedDirectory(projectRoot);
  const destination = path.join(projectRoot, input.workflowId);
  const lockPath = `${destination}.lock`;
  const lock = await open(lockPath, "wx", 0o600).catch(() => {
    throw new Error("Trusted repository checkout destination is already reserved");
  });
  let temporary: string | undefined;
  try {
    try {
      await lstat(destination);
      throw new Error("Trusted repository checkout destination already exists");
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Trusted repository checkout destination already exists"
      ) {
        throw error;
      }
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }

    temporary = await mkdtemp(path.join(projectRoot, `.preparing-${input.workflowId}-`));
    const token = await readGithubToken(repository.hostname, runner, signal);
    const environment = gitEnvironment(repository.hostname, token);
    const runGit = async (args: readonly string[], cwd: string) =>
      runner("git", [...gitSafetyArgs, ...args], {
        cwd,
        environment,
        timeoutMs: commandTimeoutMs,
        maxOutputBytes: commandOutputLimitBytes,
        signal,
      });

    assertCommandSucceeded(
      await runGit(
        [
          "clone",
          "--no-checkout",
          "--no-tags",
          "--template=/dev/null",
          "--filter=blob:none",
          "--",
          repository.toString(),
          temporary,
        ],
        projectRoot,
      ),
      "clone",
    );
    assertCommandSucceeded(
      await runGit(
        ["-C", temporary, "fetch", "--no-tags", "--depth=1", "origin", input.baseRevision],
        projectRoot,
      ),
      "fetch",
    );
    const revision = await runGit(
      ["-C", temporary, "rev-parse", "--verify", `${input.baseRevision}^{commit}`],
      projectRoot,
    );
    assertCommandSucceeded(revision, "revision verification");
    if (revision.stdout.trim() !== input.baseRevision) {
      throw new Error("Trusted repository checkout resolved a different commit");
    }
    assertCommandSucceeded(
      await runGit(
        ["-C", temporary, "checkout", "--detach", "--force", input.baseRevision],
        projectRoot,
      ),
      "detached checkout",
    );
    const checkedOutRevision = await runGit(
      ["-C", temporary, "rev-parse", "--verify", "HEAD"],
      projectRoot,
    );
    assertCommandSucceeded(checkedOutRevision, "checked out revision verification");
    if (checkedOutRevision.stdout.trim() !== input.baseRevision) {
      throw new Error("Trusted repository checkout resolved a different commit");
    }
    const symbolicHead = await runGit(
      ["-C", temporary, "symbolic-ref", "--quiet", "--short", "HEAD"],
      projectRoot,
    );
    if (symbolicHead.exitCode !== 1) {
      throw new Error("Trusted repository checkout is not detached");
    }
    await rename(temporary, destination);
    temporary = undefined;
    return {
      path: destination,
      projectId: input.projectId,
      workflowId: input.workflowId,
      repositoryUrl: repository.toString(),
      baseRevision: input.baseRevision,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Trusted repository checkout"))
      throw error;
    throw new Error("Trusted repository checkout failed without exposing command output");
  } finally {
    if (temporary) await rm(temporary, { recursive: true, force: true });
    await lock.close();
    await unlink(lockPath).catch(() => undefined);
  }
}
