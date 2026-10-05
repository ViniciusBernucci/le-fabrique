import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, appendFile, lstat, mkdir, readFile, realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { factorySettingsSchema } from "@le-fabrique/contracts";
import { ProviderIdentityManager } from "../apps/worker/src/provider-identity";

async function binary(name: string): Promise<string> {
  for (const directory of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!path.isAbsolute(directory)) continue;
    const candidate = path.join(directory, name);
    try {
      await access(candidate, constants.X_OK);
      return await realpath(candidate);
    } catch {
      /* Try next PATH entry. */
    }
  }
  throw new Error(`Cliente oficial ${name} não encontrado no PATH.`);
}

async function main() {
  const envFile = path.resolve(".env");
  process.loadEnvFile(envFile);
  const mode = process.argv[2];
  if (mode === "setup") {
    const root =
      process.env.WORKER_PROVIDER_ROOT ??
      path.join(homedir(), ".local/share/le-fabrique/providers");
    if (
      !path.isAbsolute(root) ||
      path.resolve(root) === "/" ||
      root.startsWith(`${process.cwd()}/`)
    )
      throw new Error("Use uma raiz privada fora do repositório.");
    await mkdir(root, { recursive: true, mode: 0o700 });
    const metadata = await lstat(root);
    if (
      !metadata.isDirectory() ||
      metadata.uid !== process.getuid?.() ||
      (metadata.mode & 0o077) !== 0 ||
      (await realpath(root)) !== root
    )
      throw new Error("A raiz deve ser canônica, privada (0700) e pertencer ao usuário.");
    const entries = {
      WORKER_PROVIDER_ROOT: root,
      WORKER_ANTIGRAVITY_BINARY: process.env.WORKER_ANTIGRAVITY_BINARY ?? (await binary("agy")),
      WORKER_CODEX_BINARY: process.env.WORKER_CODEX_BINARY ?? (await binary("codex")),
      WORKER_CLAUDE_BINARY: process.env.WORKER_CLAUDE_BINARY ?? (await binary("claude")),
    };
    const contents = await readFile(envFile, "utf8");
    for (const [key, value] of Object.entries(entries)) {
      if (process.env[key]) continue;
      if (new RegExp(`^${key}=`, "m").test(contents))
        throw new Error(`Revise ${key} vazio no .env.`);
      if (!/^[a-zA-Z0-9/@+._-]+$/.test(value)) throw new Error("Caminho de configuração inválido.");
      await appendFile(envFile, `\n${key}=${value}\n`);
    }
    console.log(
      "Raiz privada e caminhos dos clientes configurados. Reinicie npm run dev para carregar o .env. Nenhuma conta foi autenticada.",
    );
    return;
  }
  if (mode !== "login") throw new Error("Use providers:setup ou providers:login -- ID_DA_CONTA.");
  const base = new URL(process.env.CONTROL_API_URL ?? "http://127.0.0.1:3000/api");
  if (
    base.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname) ||
    base.username ||
    base.password
  )
    throw new Error("O controle deve ser local na VPS.");
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) throw new Error("ADMIN_API_TOKEN ausente.");
  const headers = { Authorization: `Bearer ${token}` };
  const response = await fetch(`${base.href.replace(/\/$/, "")}/settings`, {
    headers,
    signal: AbortSignal.timeout(10_000),
    redirect: "error",
  });
  if (!response.ok) throw new Error("Não foi possível ler as contas salvas no controle.");
  const settings = factorySettingsSchema.parse(await response.json());
  const installation = settings.configuration.installations.find(
    (item) => item.id === process.argv[3],
  );
  if (installation?.provider !== "CLAUDE" || !installation.enabled)
    throw new Error("Informe o ID de uma conta Claude salva e habilitada.");
  const manager = new ProviderIdentityManager(process.env.WORKER_PROVIDER_ROOT, {
    CODEX: process.env.WORKER_CODEX_BINARY ?? "/usr/bin/codex",
    CLAUDE: process.env.WORKER_CLAUDE_BINARY ?? "/usr/bin/claude",
  });
  const identity = await manager.prepare("CLAUDE", installation.id);
  console.log(
    "Autentique sua assinatura Claude no fluxo oficial. Credenciais ficam apenas no diretório privado desta conta.",
  );
  await new Promise<void>((resolve, reject) => {
    const child = spawn(identity.binaryPath, ["auth", "login", "--claudeai"], {
      env: identity.environment,
      cwd: identity.environment.HOME,
      shell: false,
      stdio: "inherit",
      detached: true,
    });
    const stop = () => {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGTERM");
        } catch {
          /* Already stopped. */
        }
      }
    };
    const timer = setTimeout(stop, 600_000);
    process.once("SIGINT", stop);
    child.once("error", () => {
      clearTimeout(timer);
      process.removeListener("SIGINT", stop);
      reject(new Error("Falha ao iniciar login oficial."));
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      process.removeListener("SIGINT", stop);
      if (code === 0) resolve();
      else reject(new Error("Login não concluído."));
    });
  });
  const verification = await fetch(
    `${base.href.replace(/\/$/, "")}/settings/installations/${installation.id}/verifications`,
    { method: "POST", headers, signal: AbortSignal.timeout(10_000), redirect: "error" },
  );
  if (!verification.ok)
    throw new Error("Login encerrado; solicite Verificar conta e modelos no painel.");
  console.log(
    "Verificação solicitada ao worker. Reabra Configurações para conferir o estado; cadastre os nomes dos modelos Claude disponíveis na sua assinatura.",
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha na configuração dos provedores.");
  process.exitCode = 1;
});
