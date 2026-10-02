import {
  adminSessionSchema,
  type CreateProject,
  type CreateTicket,
  type FactorySettings,
  factorySettingsSchema,
  type GithubOnboardingChallenge,
  type GithubOnboardingSession,
  type GithubPullRequest,
  type GithubRepositoryVerification,
  type GithubVerification,
  githubOnboardingChallengeSchema,
  githubOnboardingSessionListSchema,
  githubOnboardingSessionSchema,
  githubPullRequestListSchema,
  githubPullRequestSchema,
  githubRepositoryVerificationListSchema,
  githubRepositoryVerificationSchema,
  githubVerificationListSchema,
  githubVerificationSchema,
  type PrepareGithubPullRequest,
  type Project,
  type ProviderOnboardingChallenge,
  type ProviderOnboardingSession,
  type ProviderVerification,
  projectListSchema,
  projectSchema,
  providerOnboardingChallengeSchema,
  providerOnboardingSessionListSchema,
  providerOnboardingSessionSchema,
  providerVerificationListSchema,
  providerVerificationSchema,
  type Ticket,
  ticketListSchema,
  ticketSchema,
  type UpdateFactorySettings,
} from "@le-fabrique/contracts";

const apiUrl = import.meta.env.VITE_API_URL ?? "/api";

async function request(path: string, token: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });
  if (!response.ok)
    throw new Error(response.status === 401 ? "Credencial inválida" : "Operação não concluída");
  return response.json();
}

export async function authenticate(token: string): Promise<void> {
  adminSessionSchema.parse(await request("/auth/session", token));
}
export async function listProjects(token: string): Promise<Project[]> {
  return projectListSchema.parse(await request("/projects", token));
}
export async function createProject(token: string, input: CreateProject): Promise<Project> {
  return projectSchema.parse(
    await request("/projects", token, { method: "POST", body: JSON.stringify(input) }),
  );
}
export async function updateProjectBaseRevision(
  token: string,
  project: Project,
  baseRevision: string,
): Promise<Project> {
  return projectSchema.parse(
    await request(`/projects/${project.id}/base-revision`, token, {
      method: "PATCH",
      body: JSON.stringify({ expectedBaseRef: project.baseRef, baseRevision }),
    }),
  );
}
export async function listTickets(token: string, projectId: string): Promise<Ticket[]> {
  return ticketListSchema.parse(await request(`/projects/${projectId}/tickets`, token));
}
export async function createTicket(
  token: string,
  projectId: string,
  input: CreateTicket,
): Promise<Ticket> {
  return ticketSchema.parse(
    await request(`/projects/${projectId}/tickets`, token, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}
export async function markTicketReady(token: string, ticket: Ticket): Promise<Ticket> {
  return ticketSchema.parse(
    await request(`/tickets/${ticket.id}/ready`, token, {
      method: "POST",
      body: JSON.stringify({ expectedVersion: ticket.version }),
    }),
  );
}

export async function getFactorySettings(token: string): Promise<FactorySettings> {
  return factorySettingsSchema.parse(await request("/settings", token));
}

export async function listGithubVerifications(token: string): Promise<GithubVerification[]> {
  return githubVerificationListSchema.parse(await request("/settings/github/verifications", token));
}

export async function requestGithubVerification(token: string): Promise<GithubVerification> {
  return githubVerificationSchema.parse(
    await request("/settings/github/verifications", token, { method: "POST" }),
  );
}

export async function listGithubRepositoryVerifications(
  token: string,
): Promise<GithubRepositoryVerification[]> {
  return githubRepositoryVerificationListSchema.parse(
    await request("/settings/github/repository-verifications", token),
  );
}

export async function requestGithubRepositoryVerification(
  token: string,
): Promise<GithubRepositoryVerification> {
  return githubRepositoryVerificationSchema.parse(
    await request("/settings/github/repository-verifications", token, { method: "POST" }),
  );
}

export async function listGithubPullRequests(token: string): Promise<GithubPullRequest[]> {
  return githubPullRequestListSchema.parse(await request("/settings/github/pull-requests", token));
}

export async function prepareGithubPullRequest(
  token: string,
  input: PrepareGithubPullRequest,
): Promise<GithubPullRequest> {
  return githubPullRequestSchema.parse(
    await request("/settings/github/pull-requests", token, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  );
}

export async function approveGithubPullRequest(
  token: string,
  pullRequest: GithubPullRequest,
): Promise<GithubPullRequest> {
  return githubPullRequestSchema.parse(
    await request(`/settings/github/pull-requests/${pullRequest.id}/approve`, token, {
      method: "POST",
      body: JSON.stringify({
        expectedVersion: pullRequest.version,
        approvalDigest: pullRequest.approvalDigest,
      }),
    }),
  );
}

export async function cancelGithubPullRequest(
  token: string,
  pullRequest: GithubPullRequest,
): Promise<GithubPullRequest> {
  return githubPullRequestSchema.parse(
    await request(`/settings/github/pull-requests/${pullRequest.id}/cancel`, token, {
      method: "POST",
      body: JSON.stringify({ expectedVersion: pullRequest.version }),
    }),
  );
}

export async function listGithubOnboardingSessions(
  token: string,
): Promise<GithubOnboardingSession[]> {
  return githubOnboardingSessionListSchema.parse(
    await request("/settings/github/onboarding", token),
  );
}

export async function requestGithubOnboarding(token: string): Promise<GithubOnboardingSession> {
  return githubOnboardingSessionSchema.parse(
    await request("/settings/github/onboarding", token, { method: "POST" }),
  );
}

export async function getGithubOnboardingChallenge(
  token: string,
  sessionId: string,
): Promise<GithubOnboardingChallenge> {
  return githubOnboardingChallengeSchema.parse(
    await request(`/settings/github/onboarding/${sessionId}/challenge`, token),
  );
}

export async function updateFactorySettings(
  token: string,
  input: UpdateFactorySettings,
): Promise<FactorySettings> {
  return factorySettingsSchema.parse(
    await request("/settings", token, { method: "PUT", body: JSON.stringify(input) }),
  );
}

export async function listProviderVerifications(token: string): Promise<ProviderVerification[]> {
  return providerVerificationListSchema.parse(await request("/settings/verifications", token));
}

export async function requestProviderVerification(
  token: string,
  installationId: string,
): Promise<ProviderVerification> {
  return providerVerificationSchema.parse(
    await request(`/settings/installations/${installationId}/verifications`, token, {
      method: "POST",
    }),
  );
}

export async function listProviderOnboardingSessions(
  token: string,
): Promise<ProviderOnboardingSession[]> {
  return providerOnboardingSessionListSchema.parse(await request("/settings/onboarding", token));
}

export async function requestProviderOnboarding(
  token: string,
  installationId: string,
): Promise<ProviderOnboardingSession> {
  return providerOnboardingSessionSchema.parse(
    await request(`/settings/installations/${installationId}/onboarding`, token, {
      method: "POST",
    }),
  );
}

export async function getProviderOnboardingChallenge(
  token: string,
  sessionId: string,
): Promise<ProviderOnboardingChallenge> {
  return providerOnboardingChallengeSchema.parse(
    await request(`/settings/onboarding/${sessionId}/challenge`, token),
  );
}
