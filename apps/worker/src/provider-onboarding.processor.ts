import { spawn } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import type {
  CompleteProviderOnboarding,
  ProviderOnboardingChallenge,
  ProviderOnboardingJob,
} from "@le-fabrique/contracts";
import { providerOnboardingChallengeSchema } from "@le-fabrique/contracts";
import { sanitizeSubscriptionEnvironment } from "@le-fabrique/runtime";
import type { ControlClient } from "./control-client";
import type { ProviderIdentity } from "./provider-identity";
import { inspectProvider } from "./provider-verification.processor";

type LoginResult = { exitCode: number | null; challengePublished: boolean };
type ChallengeSink = (challenge: ProviderOnboardingChallenge) => Promise<unknown>;
type LoginRunner = (expiresAt: string, sink: ChallengeSink) => Promise<LoginResult>;
type ProviderInspector = typeof inspectProvider;
const activeLoginProcesses = new Set<() => void>();

export function cancelProviderOnboardingProcesses(): void {
  for (const cancel of activeLoginProcesses) cancel();
}

export function extractCodexDeviceChallenge(
  output: string,
  expiresAt: string,
): ProviderOnboardingChallenge | null {
  const plainOutput = stripVTControlCharacters(output);
  const urlMatch = plainOutput.match(/https:\/\/[^\s<>"']+/i);
  const codeMatch =
    plainOutput.match(
      /(?:^|\n)[ \t]*([A-Za-z0-9]{4,12}(?:-[A-Za-z0-9]{4,12}){1,3})[ \t]*(?=\r?\n)/,
    ) ??
    plainOutput.match(
      /https:\/\/[^\s]+[ \t]+([A-Za-z0-9]{4,12}(?:-[A-Za-z0-9]{4,12}){1,3})[ \t]*(?=\r?\n)/,
    ) ??
    plainOutput.match(
      /(?:code|enter)[ \t]*[:=]?[ \t]+([A-Za-z0-9]{4,12}(?:-[A-Za-z0-9]{4,12}){1,3})\b/i,
    );
  if (!urlMatch?.[0] || !codeMatch?.[1]) return null;
  const candidate = {
    verificationUri: urlMatch[0].replace(/[),.;]+$/, ""),
    userCode: codeMatch[1],
    expiresAt,
  };
  const parsed = providerOnboardingChallengeSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

export async function runCodexDeviceLogin(
  expiresAt: string,
  challengeSink: ChallengeSink,
  identity?: ProviderIdentity,
): Promise<LoginResult> {
  return await new Promise((resolve, reject) => {
    const environment =
      identity?.environment ?? sanitizeSubscriptionEnvironment(process.env).environment;
    const child = spawn(
      identity?.binaryPath ?? "codex",
      [...(identity?.binaryArgsPrefix ?? []), "login", "--device-auth"],
      {
        env: { PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin", ...environment },
        detached: process.platform !== "win32",
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    let challengePublished = false;
    let challengePublishFailed = false;
    let publishTask: Promise<unknown> | null = null;
    const kill = () => {
      if (child.pid && process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
      else child.kill("SIGKILL");
    };
    activeLoginProcesses.add(kill);
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      activeLoginProcesses.delete(kill);
      clearTimeout(timer);
      callback();
    };
    const append = (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 64 * 1024) {
        kill();
        finish(() => reject(new Error("Onboarding output limit exceeded")));
        return;
      }
      chunks.push(chunk);
      if (publishTask) return;
      const challenge = extractCodexDeviceChallenge(
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
    child.once("error", () => finish(() => reject(new Error("Codex login could not start"))));
    child.once("close", (exitCode) => {
      void (publishTask ?? Promise.resolve()).then(() =>
        finish(() =>
          challengePublishFailed
            ? reject(new Error("Onboarding challenge could not be published"))
            : resolve({ exitCode, challengePublished }),
        ),
      );
    });
    const remainingMs = Math.max(1, Math.min(10 * 60 * 1_000, Date.parse(expiresAt) - Date.now()));
    const timer = setTimeout(() => {
      kill();
      finish(() => reject(new Error("Onboarding session expired")));
    }, remainingMs);
    timer.unref();
  });
}

export async function processProviderOnboarding(
  job: ProviderOnboardingJob,
  control: ControlClient,
  runner: LoginRunner = runCodexDeviceLogin,
  inspector: ProviderInspector = inspectProvider,
) {
  await control.startProviderOnboarding(job.sessionId);
  let result: Omit<CompleteProviderOnboarding, "workerId">;
  try {
    const login = await runner(job.expiresAt, (challenge) =>
      control.publishProviderOnboardingChallenge(job.sessionId, challenge),
    );
    const verification = await inspector(job.provider);
    if (login.exitCode === 0 && verification.providerState === "AVAILABLE") {
      result = {
        status: "COMPLETED",
        providerState: "AVAILABLE",
        message:
          job.provider === "CODEX"
            ? "Official Codex subscription login confirmed"
            : "Official provider account login confirmed",
      };
    } else {
      result = {
        status: "FAILED",
        providerState: verification.providerState,
        message: "Provider login was not confirmed by the official client",
      };
    }
  } catch (error) {
    const expired = error instanceof Error && error.message === "Onboarding session expired";
    result = {
      status: expired ? "EXPIRED" : "FAILED",
      providerState: expired ? "AUTH_REQUIRED" : "ERROR",
      message: expired
        ? "Login window expired"
        : "Provider login failed without persisted client output",
    };
  }
  return control.completeProviderOnboarding(job.sessionId, result);
}
