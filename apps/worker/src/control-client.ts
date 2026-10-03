import { arch, platform } from "node:os";
import type {
  CompleteGithubOnboarding,
  CompleteGithubPullRequest,
  CompleteGithubRepositoryVerification,
  CompleteGithubVerification,
  CompleteProviderOnboarding,
  CompleteProviderVerification,
  GithubOnboardingChallenge,
  OrchestrationCheckpointRequest,
  OrchestrationClaimRequest,
  OrchestrationCompleteRequest,
  OrchestrationJob,
  OrchestrationLeaseRequest,
  ProviderOnboardingChallenge,
  ReportExecutionResult,
  WorkerConfigurationSnapshot,
} from "@le-fabrique/contracts";
import {
  executionResultReceiptSchema,
  githubOnboardingSessionSchema,
  githubPullRequestSchema,
  githubRepositoryVerificationSchema,
  githubVerificationSchema,
  orchestrationClaimSchema,
  orchestrationReconcileResultSchema,
  orchestrationStateSchema,
  providerOnboardingSessionSchema,
  providerVerificationSchema,
  workerConfigurationSnapshotSchema,
  workerHeartbeatSchema,
  workerSchema,
} from "@le-fabrique/contracts";
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
    if (!response.ok) throw new ControlRequestError(response.status);
    return response.json();
  }

  async register() {
    return workerSchema.parse(
      await this.request("/internal/workers/register", {
        method: "POST",
        body: JSON.stringify({
          id: this.config.WORKER_ID,
          name: this.config.WORKER_NAME,
          capabilities: [
            "probe",
            "subscription-client-preflight",
            "codex-device-onboarding",
            "github-cli-verification",
            "github-device-onboarding",
            "github-repository-read-verification",
            "github-pull-request-gated-create",
          ],
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

  async getWorkerConfiguration(): Promise<WorkerConfigurationSnapshot> {
    return workerConfigurationSnapshotSchema.parse(
      await this.request("/internal/worker-settings", { method: "GET" }),
    );
  }

  async claim(job: OrchestrationJob, leaseDurationMs = 90_000) {
    const body: OrchestrationClaimRequest = {
      ...job,
      workerId: this.config.WORKER_ID,
      leaseDurationMs,
    };
    return orchestrationClaimSchema.parse(
      await this.request("/internal/orchestration/claims", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  }

  async renew(attemptId: string, input: Omit<OrchestrationLeaseRequest, "workerId">) {
    return orchestrationClaimSchema.parse(
      await this.request(`/internal/orchestration/attempts/${attemptId}/lease`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async reportResult(attemptId: string, input: Omit<ReportExecutionResult, "workerId">) {
    return executionResultReceiptSchema.parse(
      await this.request(`/internal/orchestration/attempts/${attemptId}/result`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async reconcile(attemptId: string, fencingToken: number) {
    return orchestrationReconcileResultSchema.parse(
      await this.request(`/internal/orchestration/attempts/${attemptId}/reconcile`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID, fencingToken }),
      }),
    );
  }

  async checkpoint(attemptId: string, input: Omit<OrchestrationCheckpointRequest, "workerId">) {
    return orchestrationStateSchema.parse(
      await this.request(`/internal/orchestration/attempts/${attemptId}/checkpoint`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async complete(attemptId: string, input: Omit<OrchestrationCompleteRequest, "workerId">) {
    return orchestrationStateSchema.parse(
      await this.request(`/internal/orchestration/attempts/${attemptId}/complete`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async startProviderVerification(verificationId: string) {
    return providerVerificationSchema.parse(
      await this.request(`/internal/provider-verifications/${verificationId}/start`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async completeProviderVerification(
    verificationId: string,
    input: Omit<CompleteProviderVerification, "workerId">,
  ) {
    return providerVerificationSchema.parse(
      await this.request(`/internal/provider-verifications/${verificationId}/complete`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async startGithubVerification(verificationId: string) {
    return githubVerificationSchema.parse(
      await this.request(`/internal/github-verifications/${verificationId}/start`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async completeGithubVerification(
    verificationId: string,
    input: Omit<CompleteGithubVerification, "workerId">,
  ) {
    return githubVerificationSchema.parse(
      await this.request(`/internal/github-verifications/${verificationId}/complete`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async startGithubOnboarding(sessionId: string) {
    return githubOnboardingSessionSchema.parse(
      await this.request(`/internal/github-onboarding/${sessionId}/start`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async publishGithubOnboardingChallenge(sessionId: string, challenge: GithubOnboardingChallenge) {
    return githubOnboardingSessionSchema.parse(
      await this.request(`/internal/github-onboarding/${sessionId}/challenge`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID, challenge }),
      }),
    );
  }

  async completeGithubOnboarding(
    sessionId: string,
    input: Omit<CompleteGithubOnboarding, "workerId">,
  ) {
    return githubOnboardingSessionSchema.parse(
      await this.request(`/internal/github-onboarding/${sessionId}/complete`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async startGithubRepositoryVerification(verificationId: string) {
    return githubRepositoryVerificationSchema.parse(
      await this.request(`/internal/github-repository-verifications/${verificationId}/start`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async completeGithubRepositoryVerification(
    verificationId: string,
    input: Omit<CompleteGithubRepositoryVerification, "workerId">,
  ) {
    return githubRepositoryVerificationSchema.parse(
      await this.request(`/internal/github-repository-verifications/${verificationId}/complete`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async startGithubPullRequest(requestId: string) {
    return githubPullRequestSchema.parse(
      await this.request(`/internal/github-pull-requests/${requestId}/start`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async completeGithubPullRequest(
    requestId: string,
    input: Omit<CompleteGithubPullRequest, "workerId">,
  ) {
    return githubPullRequestSchema.parse(
      await this.request(`/internal/github-pull-requests/${requestId}/complete`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async startProviderOnboarding(sessionId: string) {
    return providerOnboardingSessionSchema.parse(
      await this.request(`/internal/provider-onboarding/${sessionId}/start`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID }),
      }),
    );
  }

  async publishProviderOnboardingChallenge(
    sessionId: string,
    challenge: ProviderOnboardingChallenge,
  ) {
    return providerOnboardingSessionSchema.parse(
      await this.request(`/internal/provider-onboarding/${sessionId}/challenge`, {
        method: "POST",
        body: JSON.stringify({ workerId: this.config.WORKER_ID, challenge }),
      }),
    );
  }

  async completeProviderOnboarding(
    sessionId: string,
    input: Omit<CompleteProviderOnboarding, "workerId">,
  ) {
    return providerOnboardingSessionSchema.parse(
      await this.request(`/internal/provider-onboarding/${sessionId}/complete`, {
        method: "POST",
        body: JSON.stringify({ ...input, workerId: this.config.WORKER_ID }),
      }),
    );
  }
}

export class ControlRequestError extends Error {
  constructor(readonly status: number) {
    super(`Control request failed with status ${status}`);
    this.name = "ControlRequestError";
  }
}

interface RegistrationRetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  wait?: (delayMs: number) => Promise<void>;
  onRetry?: (input: { failedAttempt: number; maxAttempts: number; delayMs: number }) => void;
}

function isTransientRegistrationError(error: unknown): boolean {
  return (
    error instanceof TypeError || (error instanceof ControlRequestError && error.status >= 500)
  );
}

const waitFor = (delayMs: number): Promise<void> =>
  new Promise((resolveWait) => setTimeout(resolveWait, delayMs));

export async function registerWithRetry(
  client: Pick<ControlClient, "register">,
  options: RegistrationRetryOptions = {},
): Promise<void> {
  const maxAttempts = options.maxAttempts ?? 30;
  const delayMs = options.delayMs ?? 1000;
  const wait = options.wait ?? waitFor;

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError("maxAttempts must be a positive integer");
  }
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new RangeError("delayMs must be a non-negative integer");
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.register();
      return;
    } catch (error) {
      if (attempt === maxAttempts || !isTransientRegistrationError(error)) throw error;
      options.onRetry?.({ failedAttempt: attempt, maxAttempts, delayMs });
      await wait(delayMs);
    }
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
