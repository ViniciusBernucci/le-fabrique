import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const developmentCommands = [
  "npm run dev -w @le-fabrique/api",
  "npm run dev -w @le-fabrique/worker",
  "npm run dev -w @le-fabrique/web",
];

export function loadRootEnvironment(rootDirectory = process.cwd()) {
  const environmentPath = resolve(rootDirectory, ".env");
  try {
    process.loadEnvFile(environmentPath);
  } catch (error) {
    throw new Error(
      `Nao foi possivel carregar ${environmentPath}. Copie .env.example para .env antes de iniciar.`,
      { cause: error },
    );
  }
  return environmentPath;
}

export function startDevelopmentProcesses(spawnProcess = spawn) {
  return spawnProcess(
    "concurrently",
    ["-n", "api,worker,web", "-c", "blue,magenta,green", ...developmentCommands],
    {
      env: process.env,
      shell: false,
      stdio: "inherit",
    },
  );
}

async function main() {
  loadRootEnvironment();
  const child = startDevelopmentProcesses();

  child.once("error", (error) => {
    console.error("falha ao iniciar os processos de desenvolvimento", {
      error: error instanceof Error ? error.message : "unknown",
    });
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (signal) {
      console.error("processos de desenvolvimento encerrados por sinal", { signal });
      process.exitCode = 1;
      return;
    }
    process.exitCode = code ?? 1;
  });
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) {
  await main();
}
