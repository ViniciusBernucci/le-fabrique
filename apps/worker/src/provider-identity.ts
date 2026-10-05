import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, mkdir, open, realpath } from "node:fs/promises";
import path from "node:path";
import type { AgentRoute, SettingsProvider } from "@le-fabrique/contracts";
import { ClaudeAdapter, CodexAdapter, type RuntimeAdapter } from "@le-fabrique/runtime";

import { requireClaudeConfinementProof } from "./claude-confinement";

export interface ProviderIdentity {
  binaryPath: string;
  binaryArgsPrefix: readonly string[];
  environment: NodeJS.ProcessEnv;
}

/** Trusted supervisor only. Never serialize this object into control-plane data. */
export class ProviderIdentityManager {
  constructor(
    private readonly root: string | undefined,
    private readonly binaries: { CODEX: string; CLAUDE: string; ANTIGRAVITY?: string },
    private readonly sourceEnvironment: NodeJS.ProcessEnv = process.env,
  ) {}

  async prepare(provider: SettingsProvider, installationId: string): Promise<ProviderIdentity> {
    if (process.platform !== "linux") throw new Error("Installation identities require Linux");
    if (provider !== "CODEX" && provider !== "CLAUDE" && provider !== "ANTIGRAVITY")
      throw new Error("Provider installation identity is unsupported");
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(installationId))
      throw new Error("Invalid installation identity");
    if (!this.root || !path.isAbsolute(this.root) || path.resolve(this.root) === "/")
      throw new Error("Private provider root is required");
    const root = path.resolve(this.root);
    await assertPrivateDirectory(root);
    const binaryPath = this.binaries[provider];
    if (!binaryPath) throw new Error("Provider binary is not configured");
    if (!path.isAbsolute(binaryPath)) throw new Error("Provider binary must be absolute");
    const account = await privateChild(root, `${provider.toLowerCase()}-${installationId}`);
    const home = await privateChild(account, "home");
    const store = await privateChild(account, "store");
    const cache = await privateChild(account, "cache");
    // An allowlist, not process.env with a few known secrets removed. This also excludes
    // factory tokens, OAuth overrides, cloud credentials, endpoint overrides and hooks.
    const environment: NodeJS.ProcessEnv = {
      PATH: this.sourceEnvironment.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      HOME: home,
      XDG_CONFIG_HOME: store,
      XDG_CACHE_HOME: cache,
      LANG: this.sourceEnvironment.LANG ?? "C.UTF-8",
    };
    if (provider === "CODEX") environment.CODEX_HOME = store;
    else if (provider === "CLAUDE") environment.CLAUDE_CONFIG_DIR = store;
    else {
      environment.SSH_CONNECTION = "127.0.0.1 0 127.0.0.1 0";
      environment.TERM = "xterm-256color";
      environment.XDG_RUNTIME_DIR = await privateChild(account, "runtime");
    }
    if (provider === "ANTIGRAVITY") {
      try {
        await Promise.all(
          ["/usr/bin/dbus-run-session", "/usr/bin/dbus-send", "/usr/bin/gnome-keyring-daemon"].map(
            (binary) => access(binary, constants.X_OK),
          ),
        );
      } catch {
        throw new Error("Antigravity private keyring dependencies missing");
      }
      const secretPath = path.join(account, "keyring-unlock");
      try {
        const file = await open(secretPath, "wx", 0o600);
        try {
          await file.writeFile(randomBytes(32).toString("hex"));
        } finally {
          await file.close();
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const metadata = await lstat(secretPath);
      if (
        !metadata.isFile() ||
        metadata.isSymbolicLink() ||
        metadata.uid !== process.getuid?.() ||
        (metadata.mode & 0o077) !== 0 ||
        metadata.size !== 64
      )
        throw new Error("Private keyring configuration unavailable");
      let launcher = path.join(__dirname, "antigravity-keyring-launcher.js");
      try {
        await access(launcher, constants.R_OK);
      } catch {
        launcher = path.resolve(__dirname, "../dist/antigravity-keyring-launcher.js");
        await access(launcher, constants.R_OK).catch(() => {
          throw new Error("Antigravity keyring launcher must be built");
        });
      }
      return {
        binaryPath: "/usr/bin/dbus-run-session",
        binaryArgsPrefix: ["--", process.execPath, launcher, binaryPath, secretPath],
        environment,
      };
    }
    return {
      binaryPath,
      binaryArgsPrefix:
        provider === "CODEX"
          ? ["-c", 'cli_auth_credentials_store="file"', "-c", 'forced_login_method="chatgpt"']
          : [],
      environment,
    };
  }

  async adapter(route: AgentRoute): Promise<RuntimeAdapter> {
    const identity = await this.prepare(
      route.provider === "codex" ? "CODEX" : "CLAUDE",
      route.installationId,
    );
    if (route.provider === "claude" && route.permissionMode !== "READ_ONLY") {
      if (!this.root) throw new Error("Private provider root is required");
      await requireClaudeConfinementProof(
        path.resolve(this.root),
        route.installationId,
        identity.binaryPath,
      );
    }
    return route.provider === "codex" ? new CodexAdapter(identity) : new ClaudeAdapter(identity);
  }
}

async function assertPrivateDirectory(directory: string): Promise<void> {
  const metadata = await lstat(directory);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    metadata.uid !== process.getuid?.() ||
    (metadata.mode & 0o077) !== 0 ||
    (await realpath(directory)) !== directory
  )
    throw new Error("Provider directory must be canonical, owned and private");
}

async function privateChild(parent: string, name: string): Promise<string> {
  const child = path.join(parent, name);
  await mkdir(child, { mode: 0o700 }).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "EEXIST") throw error;
  });
  await assertPrivateDirectory(child);
  return child;
}
