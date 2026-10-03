import { lstat, mkdir, realpath } from "node:fs/promises";
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
    private readonly binaries: { CODEX: string; CLAUDE: string },
    private readonly sourceEnvironment: NodeJS.ProcessEnv = process.env,
  ) {}

  async prepare(provider: SettingsProvider, installationId: string): Promise<ProviderIdentity> {
    if (process.platform !== "linux") throw new Error("Installation identities require Linux");
    if (provider !== "CODEX" && provider !== "CLAUDE")
      throw new Error("Provider installation identity is unsupported");
    if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(installationId))
      throw new Error("Invalid installation identity");
    if (!this.root || !path.isAbsolute(this.root) || path.resolve(this.root) === "/")
      throw new Error("Private provider root is required");
    const root = path.resolve(this.root);
    await assertPrivateDirectory(root);
    const binaryPath = this.binaries[provider];
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
    else environment.CLAUDE_CONFIG_DIR = store;
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
