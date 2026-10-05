import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listCodexModels } from "./codex-models";

async function fixture(account: string, repeated = false) {
  const root = await mkdtemp(path.join(os.tmpdir(), "catalog-"));
  const script = path.join(root, "client.cjs");
  await writeFile(
    script,
    `
    const readline = require('node:readline');
    readline.createInterface({ input: process.stdin }).on('line', line => {
      const request = JSON.parse(line);
      let result;
      if (request.method === 'initialized') return;
      if (request.method === 'initialize') result = { serverInfo: 'fixture' };
      else if (request.method === 'account/read') result = { account: { type: ${JSON.stringify(account)} } };
      else if (request.method === 'model/list') {
        if (!request.params.cursor) result = {data:[{model:'fixture-model'},{model:'hidden-model',hidden:true}],nextCursor:'next'};
        else result = {data:[{model:'fixture-model'},{model:'other-model'}],nextCursor:${repeated ? "'next'" : "null"}};
      } else process.exit(2); // No thread/turn/inference allowed.
      process.stdout.write(JSON.stringify({id:request.id,result})+'\\n');
    });
  `,
  );
  return {
    root,
    identity: {
      binaryPath: process.execPath,
      binaryArgsPrefix: [script],
      environment: { HOME: root, PATH: process.env.PATH },
    },
  };
}

describe("Codex official metadata catalog", () => {
  it("discovers paginated models, filters hidden entries and deduplicates without inference", async () => {
    const { root, identity } = await fixture("chatgpt");
    try {
      await expect(listCodexModels(identity)).resolves.toEqual(["fixture-model", "other-model"]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("rejects API authentication without returning private account details", async () => {
    const { root, identity } = await fixture("apiKey");
    try {
      await expect(listCodexModels(identity)).rejects.toThrow("Codex model catalog unavailable");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
  it("bounds a repeated pagination cursor", async () => {
    const { root, identity } = await fixture("chatgpt", true);
    try {
      await expect(listCodexModels(identity)).rejects.toThrow("Codex model catalog unavailable");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
