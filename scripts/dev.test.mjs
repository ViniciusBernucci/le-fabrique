import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";
import { developmentCommands, loadRootEnvironment, startDevelopmentProcesses } from "./dev.mjs";

const originalProbe = process.env.LE_FABRIQUE_ENV_TEST_PROBE;

afterEach(() => {
  if (originalProbe === undefined) delete process.env.LE_FABRIQUE_ENV_TEST_PROBE;
  else process.env.LE_FABRIQUE_ENV_TEST_PROBE = originalProbe;
});

test("carrega o arquivo .env da raiz no processo launcher", () => {
  const directory = mkdtempSync(join(tmpdir(), "le-fabrique-dev-"));
  try {
    delete process.env.LE_FABRIQUE_ENV_TEST_PROBE;
    writeFileSync(join(directory, ".env"), "LE_FABRIQUE_ENV_TEST_PROBE=loaded\n", "utf8");

    assert.equal(loadRootEnvironment(directory), join(directory, ".env"));
    assert.equal(process.env.LE_FABRIQUE_ENV_TEST_PROBE, "loaded");
  } finally {
    rmSync(directory, { recursive: true });
  }
});

test("inicia os tres workspaces sem shell e com o ambiente carregado", () => {
  const child = new EventEmitter();
  const calls = [];
  const spawnProcess = (...input) => {
    calls.push(input);
    return child;
  };

  assert.equal(startDevelopmentProcesses(spawnProcess), child);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "concurrently");
  assert.deepEqual(calls[0][1], [
    "-n",
    "api,worker,web",
    "-c",
    "blue,magenta,green",
    ...developmentCommands,
  ]);
  assert.equal(calls[0][2].shell, false);
  assert.equal(calls[0][2].env, process.env);
});
