import { spawn } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
import {
  type ProviderOnboardingChallenge,
  type ProviderOnboardingJob,
  providerAuthorizationChallengeSchema,
  providerAuthorizationCodeSchema,
} from "@le-fabrique/contracts";
import { spawn as spawnTerminal } from "node-pty";
import type { ControlClient } from "./control-client";
import type { ProviderIdentity } from "./provider-identity";
import { inspectProvider, runVerificationCommand } from "./provider-verification.processor";

const active = new Set<() => void>();
export function cancelProviderAuthorizationProcesses(): void {
  for (const stop of active) stop();
}

export function extractProviderAuthorizationChallenge(
  provider: "CLAUDE" | "ANTIGRAVITY",
  output: string,
  expiresAt: string,
): ProviderOnboardingChallenge | null {
  // OSC hyperlinks contain the complete URL even when the TUI wraps the visible label.
  // biome-ignore lint/suspicious/noControlCharactersInRegex: OSC terminal hyperlink boundaries are required to preserve the complete OAuth URL.
  const rawUrls = output.match(/https:\/\/[^\s\x07\x1b<>"']+/g) ?? [];
  const candidates = [
    ...rawUrls,
    ...(stripVTControlCharacters(output).match(/https:\/\/[^\s<>"']+/g) ?? []),
  ];
  for (const candidate of candidates) {
    const parsed = providerAuthorizationChallengeSchema.safeParse({
      flow: "AUTHORIZATION_CODE",
      provider,
      verificationUri: candidate,
      expiresAt,
    });
    if (!parsed.success) continue;
    const url = new URL(parsed.data.verificationUri);
    if (
      url.searchParams.get("response_type") !== "code" ||
      !url.searchParams.get("state") ||
      !url.searchParams.get("code_challenge") ||
      !url.searchParams.get("client_id")
    )
      continue;
    return parsed.data;
  }
  return null;
}

/** Official login only. No shell, prompts, tools, arbitrary terminal input or inherited API keys. */
export function runProviderAuthorizationLogin(
  job: ProviderOnboardingJob,
  identity: ProviderIdentity,
  control: Pick<
    ControlClient,
    "publishProviderOnboardingChallenge" | "takeProviderAuthorizationCode"
  >,
): Promise<{ exitCode: number | null; challengePublished: boolean }> {
  if (job.provider === "CODEX") throw new Error("Use Codex device login");
  const provider = job.provider;
  return new Promise((resolve, reject) => {
    const terminal =
      provider === "ANTIGRAVITY"
        ? spawnTerminal(identity.binaryPath, [...identity.binaryArgsPrefix, "--mode", "plan"], {
            name: "xterm-256color",
            cols: 240,
            rows: 40,
            cwd: identity.environment.HOME,
            env: identity.environment,
          })
        : null;
    const child =
      provider === "CLAUDE"
        ? spawn(
            identity.binaryPath,
            [...identity.binaryArgsPrefix, "auth", "login", "--claudeai"],
            {
              env: identity.environment,
              cwd: identity.environment.HOME,
              shell: false,
              detached: true,
              stdio: ["pipe", "pipe", "pipe"],
            },
          )
        : null;
    const pid = terminal?.pid ?? child?.pid;
    let settled = false,
      output = "",
      bytes = 0,
      published = false,
      publishing = false,
      selected = false,
      awaitingCode = false,
      codeSent = false,
      polling = false;
    let fatal: Error | null = null;
    let authenticated = false;
    const write = (text: string) => {
      if (settled) return;
      if (terminal) terminal.write(text);
      else child?.stdin.write(text);
    };
    const stop = () => {
      if (pid)
        try {
          process.kill(-pid, "SIGKILL");
        } catch {
          terminal?.kill("SIGKILL");
          child?.kill("SIGKILL");
        }
    };
    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(poll);
      active.delete(stop);
      if (fatal) reject(fatal);
      else resolve({ exitCode: authenticated ? 0 : exitCode, challengePublished: published });
    };
    const fail = (message: string) => {
      fatal = new Error(message);
      stop();
    };
    const receive = (chunk: string) => {
      if (settled) return;
      bytes += Buffer.byteLength(chunk);
      if (bytes > 256 * 1024) {
        fail("Authorization output limit exceeded");
        return;
      }
      output += chunk;
      if (terminal) {
        for (const [query, reply] of [
          ["\x1b]10;?", "\x1b]10;rgb:ffff/ffff/ffff\x07"],
          ["\x1b]11;?", "\x1b]11;rgb:0000/0000/0000\x07"],
          ["\x1b[6n", "\x1b[1;1R"],
          ["\x1b[c", "\x1b[?1;2c"],
        ] as const)
          if (chunk.includes(query)) write(reply);
        const plain = stripVTControlCharacters(output);
        if (!selected && /1\.\s*Google OAuth/i.test(plain)) {
          selected = true;
          write("\r");
        }
      }
      if (/(?:paste|enter)[^\r\n]*code|code[^\r\n]*paste/i.test(stripVTControlCharacters(chunk)))
        awaitingCode = true;
      if (
        /login successful|signed in successfully|authenticated successfully/i.test(
          stripVTControlCharacters(chunk),
        )
      )
        awaitingCode = false;
      if (!published && !publishing) {
        const challenge = extractProviderAuthorizationChallenge(provider, output, job.expiresAt);
        if (challenge) {
          publishing = true;
          void control.publishProviderOnboardingChallenge(job.sessionId, challenge).then(
            () => {
              published = true;
            },
            () => fail("Authorization challenge publication failed"),
          );
        }
      }
      if (published) output = output.slice(-16000);
    };
    child?.stdout.on("data", (chunk) => receive(chunk.toString()));
    child?.stderr.on("data", (chunk) => receive(chunk.toString()));
    child?.stdin.on("error", () => fail("Authorization input failed"));
    child?.once("error", () => {
      fatal = new Error("Official login client could not start");
      finish(null);
    });
    child?.once("close", finish);
    terminal?.onData(receive);
    terminal?.onExit(({ exitCode }) => finish(exitCode));
    active.add(stop);
    const timeout = setTimeout(
      () => fail("Onboarding session expired"),
      Math.max(1, Math.min(600000, Date.parse(job.expiresAt) - Date.now())),
    );
    const poll = setInterval(() => {
      if (settled || !published || polling) return;
      polling = true;
      void (async () => {
        if (terminal) {
          const status = await inspectProvider("ANTIGRAVITY", (binary, args) =>
            runVerificationCommand(binary, args, identity),
          );
          if (status.providerState === "AVAILABLE") {
            authenticated = true;
            awaitingCode = false;
            stop();
            return;
          }
        }
        if (!codeSent && awaitingCode) {
          const code = await control.takeProviderAuthorizationCode(job.sessionId);
          if (code) {
            providerAuthorizationCodeSchema.parse({ code });
            codeSent = true;
            awaitingCode = false;
            write(`${code}${terminal ? "\r" : "\n"}`);
          }
        }
      })()
        .catch(() => fail("Authorization control or status failed"))
        .finally(() => {
          polling = false;
        });
    }, 1000);
  });
}
