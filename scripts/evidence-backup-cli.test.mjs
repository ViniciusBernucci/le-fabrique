import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
test("offline backup CLI refuses invalid commands without exposing supplied private details", async () => {
  for (const argv of [
    ["create", "--unknown", "synthetic-private-detail"],
    ["verify", "--archive", "/synthetic-private-path", "--key-file", "/synthetic-private-key"],
  ]) {
    try {
      await run(
        process.execPath,
        ["--import", "tsx", path.join(repository, "scripts/evidence-backup.ts"), ...argv],
        { cwd: repository, timeout: 10_000 },
      );
      assert.fail("invalid command must fail");
    } catch (error) {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /Backup operation refused or failed/);
      assert.doesNotMatch(error.stderr, /synthetic-private/);
      assert.equal(error.stdout, "");
    }
  }
});
