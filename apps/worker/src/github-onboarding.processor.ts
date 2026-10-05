import { spawn } from "node:child_process";
import type {
  CompleteGithubOnboarding,
  GithubOnboardingChallenge,
  GithubOnboardingJob,
} from "@le-fabrique/contracts";
import { githubOnboardingChallengeSchema, githubOnboardingJobSchema } from "@le-fabrique/contracts";
import type { ControlClient } from "./control-client";
import { runGithubCommand, sanitizeGithubEnvironment } from "./github-verification.processor";

type LoginResult = { exitCode: number | null; challengePublished: boolean };
type ChallengeSink = (challenge: GithubOnboardingChallenge) => Promise<unknown>;
type LoginRunner = (host: string, expiresAt: string, sink: ChallengeSink) => Promise<LoginResult>;
type CommandResult = { exitCode: number | null; stdout: string; stderr: string };
type CommandRunner = (binary: string, args: readonly string[]) => Promise<CommandResult>;
type CredentialInspection = Omit<CompleteGithubOnboarding, "workerId">;

const activeLoginProcesses = new Set<() => void>();
const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-?]*[ -/]*[@-~]`, "g");

export function cancelGithubOnboardingProcesses(): void {
  for (const cancel of activeLoginProcesses) cancel();
}

export function githubLoginArgs(host: string): readonly string[] {
  return [
    "auth",
    "login",
    "--hostname",
    host,
    "--git-protocol",
    "https",
    "--web",
    "--skip-ssh-key",
    "--clipboard=false",
  ];
}

export function extractGithubDeviceChallenge(
  output: string,
  expiresAt: string,
): GithubOnboardingChallenge | null {
  const sanitized = output.replace(ansiPattern, "");
  const urlMatch = sanitized.match(/https:\/\/[^\s<>"']+\/login\/device\/?/i);
  const codeMatch = sanitized.match(/\b([A-Z0-9]{4,12}(?:-[A-Z0-9]{4,12}){1,3})\b/);
  if (!urlMatch?.[0] || !codeMatch?.[1]) return null;
  const candidate = {
    verificationUri: urlMatch[0].replace(/[),.;]+$/, ""),
    userCode: codeMatch[1],
    expiresAt,
  };
  const parsed = githubOnboardingChallengeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function runGithubDeviceLogin(
  host: string,
  expiresAt: string,
  challengeSink: ChallengeSink,
): Promise<LoginResult> {
  return await new Promise((resolve, reject) => {
    const child = spawn("gh", [...githubLoginArgs(host)], {
      env: sanitizeGithubEnvironment(process.env),
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    let challengePublished = false;
    let challengePublishFailed = false;
    let publishTask: Promise<unknown> | null = null;
    let timer: NodeJS.Timeout | undefined;
    const kill = () => {
      if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    };
    activeLoginProcesses.add(kill);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      activeLoginProcesses.delete(kill);
      if (timer) clearTimeout(timer);
      callback();
    };
    const append = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        kill();
        finish(() => reject(new Error("GitHub onboarding output limit exceeded")));
        return;
      }
      chunks.push(chunk);
      if (publishTask) return;
      const challenge = extractGithubDeviceChallenge(
        Buffer.concat(chunks).toString("utf8"),
        expiresAt,
      );
      if (challenge) {
        publishTask = challengeSink(challenge).then(
          () => {
            challengePublished = true;
          },
          () => {
            challengePublishFailed = true;
            kill();
          },
        );
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", () => finish(() => reject(new Error("GitHub login could not start"))));
    child.once("close", (exitCode) => {
      void (publishTask ?? Promise.resolve()).then(() =>
        finish(() =>
          challengePublishFailed
            ? reject(new Error("GitHub onboarding challenge could not be published"))
            : resolve({ exitCode, challengePublished }),
        ),
      );
    });
    const remainingMs = Math.max(1, Math.min(10 * 60 * 1_000, Date.parse(expiresAt) - Date.now()));
    timer = setTimeout(() => {
      kill();
      finish(() => reject(new Error("GitHub onboarding session expired")));
    }, remainingMs);
    timer.unref();
  });
}

export async function inspectGithubCredentialStorage(
  host: string,
  runner: CommandRunner = runGithubCommand,
): Promise<CredentialInspection> {
  try {
    const status = await runner("gh", ["auth", "status", "--hostname", host, "--json", "hosts"]);
    const parsed: unknown = JSON.parse(status.stdout);
    if (typeof parsed !== "object" || parsed === null || !("hosts" in parsed)) {
      throw new Error("GitHub status JSON does not contain hosts");
    }
    const hosts = (parsed as { hosts: unknown }).hosts;
    if (typeof hosts !== "object" || hosts === null) {
      throw new Error("GitHub status hosts are invalid");
    }
    const accounts = (hosts as Record<string, unknown>)[host];
    if (accounts !== undefined && !Array.isArray(accounts)) {
      throw new Error("GitHub status accounts are invalid");
    }
    const active = Array.isArray(accounts)
      ? accounts.find((account) => {
          if (typeof account !== "object" || account === null) return false;
          const candidate = account as Record<string, unknown>;
          return candidate.active === true && String(candidate.state).toLowerCase() === "success";
        })
      : undefined;
    if (typeof active !== "object" || active === null) {
      return {
        status: "FAILED",
        githubState: "AUTH_REQUIRED",
        credentialStorage: "UNKNOWN",
        message: "GitHub login was not confirmed by the official client",
      };
    }
    const tokenSource = (active as Record<string, unknown>).tokenSource;
    if (tokenSource === "keyring") {
      return {
        status: "COMPLETED",
        githubState: "CONNECTED",
        credentialStorage: "SECURE_STORE",
        message: "GitHub login confirmed with secure credential storage",
      };
    }
    if (typeof tokenSource === "string" && /hosts\.ya?ml$/i.test(tokenSource)) {
      return {
        status: "FAILED",
        githubState: "ERROR",
        credentialStorage: "PLAINTEXT_FILE",
        message: "GitHub credential store unavailable; plaintext fallback is not eligible",
      };
    }
    return {
      status: "FAILED",
      githubState: "ERROR",
      credentialStorage: "UNKNOWN",
      message: "GitHub credential storage could not be verified as secure",
    };
  } catch {
    return {
      status: "FAILED",
      githubState: "ERROR",
      credentialStorage: "UNKNOWN",
      message: "GitHub login verification failed without persisted client output",
    };
  }
}

export async function processGithubOnboarding(
  untrustedJob: GithubOnboardingJob,
  control: ControlClient,
  loginRunner: LoginRunner = runGithubDeviceLogin,
  inspector: typeof inspectGithubCredentialStorage = inspectGithubCredentialStorage,
) {
  const job = githubOnboardingJobSchema.parse(untrustedJob);
  await control.startGithubOnboarding(job.sessionId);
  let result: CredentialInspection;
  try {
    const login = await loginRunner(job.host, job.expiresAt, (challenge) =>
      control.publishGithubOnboardingChallenge(job.sessionId, challenge),
    );
    const verification = await inspector(job.host);
    result =
      login.exitCode === 0 && login.challengePublished
        ? verification
        : {
            status: "FAILED",
            githubState:
              verification.githubState === "CONNECTED" ? "ERROR" : verification.githubState,
            credentialStorage: verification.credentialStorage,
            message: "GitHub login was not confirmed by the official client",
          };
  } catch (error) {
    const expired = error instanceof Error && error.message === "GitHub onboarding session expired";
    result = {
      status: expired ? "EXPIRED" : "FAILED",
      githubState: expired ? "AUTH_REQUIRED" : "ERROR",
      credentialStorage: "UNKNOWN",
      message: expired
        ? "Login window expired"
        : "GitHub login failed without persisted client output",
    };
  }
  return control.completeGithubOnboarding(job.sessionId, result);
}
