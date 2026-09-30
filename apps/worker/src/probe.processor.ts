import {
  type HealthResponse,
  type WorkerProbeJob,
  workerProbeJobSchema,
} from "@le-fabrique/contracts";

export interface ProbeResult {
  correlationId: string;
  health: HealthResponse;
}

export function processProbe(payload: WorkerProbeJob): ProbeResult {
  const job = workerProbeJobSchema.parse(payload);
  return {
    correlationId: job.correlationId,
    health: {
      status: "ok",
      service: "worker",
      timestamp: new Date().toISOString(),
    },
  };
}
