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
} from "@le-fabrique/contracts";
import {
  githubOnboardingSessionSchema,
  githubPullRequestSchema,
  githubRepositoryVerificationSchema,
  githubVerificationSchema,
  orchestrationClaimSchema,
  orchestrationStateSchema,
  providerOnboardingSessionSchema,
  providerVerificationSchema,
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
