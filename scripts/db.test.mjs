import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { startDatabaseCommand } from "./db.mjs";

test("Prisma recebe ambiente raiz em subprocesso real sem depender do cwd do workspace", async () => {
  const root = mkdtempSync(join(tmpdir(), "le-fabrique-db-"));
  const key = "LE_FABRIQUE_DB_ENV_PROBE";
  const previous = process.env[key];
  try {
    delete process.env[key];
    writeFileSync(join(root, ".env"), `${key}=synthetic-only\n`);
    const child = startDatabaseCommand(
      "status",
      (binary, args, options) => {
        assert.equal(binary, process.execPath);
        assert.ok(args[0].endsWith("prisma/build/index.js"));
        assert.deepEqual(args.slice(1, 3), ["migrate", "status"]);
        assert.equal(options.shell, false);
        return spawn(
          process.execPath,
          ["-e", `process.exit(process.env.${key} === 'synthetic-only' ? 0 : 1)`],
          { ...options, cwd: tmpdir(), stdio: "ignore" },
        );
      },
      root,
    );
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    assert.equal(code, 0);
    assert.throws(() => startDatabaseCommand("reset", undefined, root));
  } finally {
    if (previous === undefined) delete process.env[key];
    else process.env[key] = previous;
    rmSync(root, { recursive: true });
  }
});
