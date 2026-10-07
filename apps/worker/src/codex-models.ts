import { spawn } from "node:child_process";
import { z } from "zod";
import type { ProviderIdentity } from "./provider-identity";

const modelPage = z.object({
  data: z
    .array(
      z.object({
        model: z
          .string()
          .min(1)
          .max(120)
          .regex(/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/),
        hidden: z.boolean().optional(),
      }),
    )
    .max(50),
  nextCursor: z.string().max(4096).nullable().optional(),
});

/** Metadata only: never creates a thread or submits an inference request. */
export function listCodexModels(identity: ProviderIdentity): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      identity.binaryPath,
      [...identity.binaryArgsPrefix, "--no-daemon", "app-server", "--listen", "stdio://"],
      {
        env: identity.environment,
        cwd: identity.environment.HOME,
        detached: process.platform !== "win32",
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    let buffer = "";
    let bytes = 0;
    let settled = false;
    let requestId = 3;
    const models = new Set<string>();
    const cursors = new Set<string>();
    const stop = () => {
      if (child.pid) {
        try {
          if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {
          /* The process may already have exited. */
        }
      }
    };
    const finish = (result?: string[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      stop();
      if (result) resolve(result);
      else reject(new Error("Codex model catalog unavailable"));
    };
    const send = (method: string, params: unknown, id?: number) => {
      child.stdin.write(
        `${JSON.stringify({ method, params, ...(id === undefined ? {} : { id }) })}\n`,
      );
    };
    const timer = setTimeout(() => finish(), 15_000);
    timer.unref();
    child.once("error", () => finish());
    child.stdin.on("error", () => finish());
    child.once("close", () => finish());
    child.stderr.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) finish();
    });
    child.stdout.on("data", (chunk: Buffer) => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > 1024 * 1024) return finish();
      buffer += chunk.toString("utf8");
      let newline = buffer.indexOf("\n");
      while (newline >= 0 && !settled) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 1);
        try {
          const response = JSON.parse(line);
          if (response.id === 1) {
            if (response.error || !response.result) return finish();
            send("initialized", {});
            send("account/read", { refreshToken: false }, 2);
          } else if (response.id === 2) {
            if (response.error || response.result?.account?.type !== "chatgpt") return finish();
            send("model/list", { limit: 50, includeHidden: false }, requestId);
          } else if (response.id === requestId) {
            if (response.error) return finish();
            const page = modelPage.parse(response.result);
            for (const entry of page.data) if (!entry.hidden) models.add(entry.model);
            if (models.size > 50) return finish();
            if (!page.nextCursor) return finish([...models]);
            if (cursors.has(page.nextCursor) || cursors.size >= 10) return finish();
            cursors.add(page.nextCursor);
            requestId++;
            send(
              "model/list",
              { limit: 50, includeHidden: false, cursor: page.nextCursor },
              requestId,
            );
          }
        } catch {
          return finish();
        }
        newline = buffer.indexOf("\n");
      }
    });
    send(
      "initialize",
      {
        clientInfo: { name: "le_fabrique_catalog", title: "La fabrique", version: "0.1.0" },
        capabilities: {},
      },
      1,
    );
  });
}
