import { arch, platform } from "node:os";
import { workerHeartbeatSchema, workerSchema } from "@le-fabrique/contracts";
import type { WorkerConfig } from "./config";

export class ControlClient {
  constructor(
    private readonly config: WorkerConfig,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  private async request(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetcher(`${this.config.CONTROL_API_URL}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.WORKER_API_TOKEN}`,
      },
    });
    if (!response.ok) throw new Error(`Control request failed with status ${response.status}`);
    return response.json();
  }

  async register() {
    return workerSchema.parse(
      await this.request("/internal/workers/register", {
        method: "POST",
        body: JSON.stringify({
          id: this.config.WORKER_ID,
          name: this.config.WORKER_NAME,
          capabilities: ["probe", "subscription-client-preflight"],
          os: platform(),
          arch: arch(),
          nodeVersion: process.version,
        }),
      }),
    );
  }

  async heartbeat() {
    return workerHeartbeatSchema.parse(
      await this.request(`/internal/workers/${this.config.WORKER_ID}/heartbeat`, {
        method: "POST",
      }),
    );
  }
}

export function startHeartbeat(
  client: ControlClient,
  intervalMs: number,
  onUnavailable: () => void,
): () => void {
  let consecutiveFailures = 0;
  const timer = setInterval(() => {
    void client
      .heartbeat()
      .then(() => {
        consecutiveFailures = 0;
      })
      .catch(() => {
        consecutiveFailures += 1;
        console.error("worker heartbeat failed", { consecutiveFailures });
        if (consecutiveFailures >= 3) onUnavailable();
      });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
