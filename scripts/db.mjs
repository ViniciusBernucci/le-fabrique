import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { loadRootEnvironment } from "./dev.mjs";

const repository = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiRequire = createRequire(resolve(repository, "apps/api/package.json"));
const commands = {
  status: ["migrate", "status"],
  deploy: ["migrate", "deploy"],
  migrate: ["migrate", "dev"],
};

export function startDatabaseCommand(command, spawnProcess = spawn, root = repository) {
  const args = commands[command];
  if (!args) throw new Error("Use status, deploy ou migrate.");
  loadRootEnvironment(root);
  return spawnProcess(
    process.execPath,
    [
      apiRequire.resolve("prisma/build/index.js"),
      ...args,
      "--schema",
      resolve(root, "apps/api/prisma/schema.prisma"),
    ],
    { cwd: root, env: process.env, shell: false, stdio: "inherit" },
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const child = startDatabaseCommand(process.argv[2]);
    child.once("error", () => {
      console.error("Falha ao iniciar Prisma; confira npm ci e o .env raiz.");
      process.exitCode = 1;
    });
    child.once("exit", (code) => {
      process.exitCode = code ?? 1;
    });
  } catch {
    console.error("Falha ao preparar comando Prisma; confira comando e .env raiz.");
    process.exitCode = 1;
  }
}
