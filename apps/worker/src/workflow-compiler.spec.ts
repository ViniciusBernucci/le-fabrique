import type { ExecutionSpecification } from "@le-fabrique/contracts";
import { describe, expect, it } from "vitest";
import { compileWorkflowRequest, type TrustedWorkflowProfile } from "./workflow-compiler";

const projectId = "00000000-0000-4000-8000-000000000021";
const workflowId = "00000000-0000-4000-8000-000000000022";
const baseRevision = "a".repeat(40);

const specification: ExecutionSpecification = {
  schemaVersion: 1,
  project: {
    id: projectId,
    name: "Projeto cadastrado pelo operador",
    repoUrl: "https://github.com/example/project",
    baseRevision,
    definitionVersion: 2,
    definition: {
      summary: "Aplicacao configurada pelo operador",
      externalStack: "Stack definida no cadastro",
      instructions: "Preservar o comportamento existente",
      allowedPaths: ["src", "README.md"],
      forbiddenPaths: ["secrets"],
      checks: [{ name: "unit", command: "/usr/bin/npm", args: ["test", "--", "--run"] }],
      executionProfile: {
        contextSources: [{ path: "README.md", role: "INSTRUCTION" }],
        approvedChecks: [{ name: "unit", command: "/usr/bin/npm", args: ["test", "--", "--run"] }],
      },
    },
  },
  ticket: {
    id: "00000000-0000-4000-8000-000000000023",
    version: 3,
    title: "Incremento configurado",
    objective: "Implementar a melhoria descrita",
    acceptanceCriteria: ["Os testes passam"],
  },
};

const profile: TrustedWorkflowProfile = {
  projectId,
  repositoryUrl: specification.project.repoUrl,
  repositoryPath: "/srv/le-fabrique/checkouts/project",
  baseRevision,
  contextSources: [{ path: "README.md", role: "INSTRUCTION" }],
  contextLimits: { maxFiles: 10, maxFileBytes: 10_000, maxTotalBytes: 20_000 },
  allowedChecks: [{ name: "unit", command: "/usr/bin/npm", args: ["test", "--", "--run"] }],
  guardPolicy: {
    schemaVersion: 1,
    maxAttempts: 4,
    maxElapsedMs: 600_000,
    maxProviderSwitches: 0,
    repeatedFailureLimit: 2,
    subscriptionOnly: true,
    monthlyApiBudget: 0,
    apiFallbackEnabled: false,
    paidExtrasAllowed: false,
  },
  runtimeLimits: { timeoutMs: 60_000, maxLogBytes: 100_000 },
  sandboxLimits: {
    timeoutMs: 60_000,
    maxLogBytes: 100_000,
    memoryBytes: 256 * 1024 * 1024,
    cpuQuotaPercent: 100,
    maxProcesses: 64,
    maxOpenFiles: 256,
    maxFileBytes: 10 * 1024 * 1024,
  },
  snapshotLimits: { maxUntrackedFiles: 100, maxArtifactBytes: 10 * 1024 * 1024 },
  maxCorrectionRounds: 1,
  modelRequested: null,
};

describe("compileWorkflowRequest", () => {
  it("compiles snapshot values and trusted runtime configuration into a validated request", () => {
    const request = compileWorkflowRequest(workflowId, specification, profile);

    expect(request.workflowId).toBe(workflowId);
    expect(request.repositoryPath).toBe(profile.repositoryPath);
    expect(request.baseRevision).toBe(baseRevision);
    expect(request.objective).toContain(specification.ticket.objective);
    expect(request.objective).toContain(specification.project.definition.instructions);
    expect(request.acceptanceCriteria).toEqual(specification.ticket.acceptanceCriteria);
    expect(request.checks).toEqual([{ ...profile.allowedChecks[0], environment: {} }]);
    expect(request.modelRequested).toBeNull();
  });

  it("rejects a repository binding that does not match the immutable project snapshot", () => {
    expect(() =>
      compileWorkflowRequest(workflowId, specification, {
        ...profile,
        repositoryUrl: "https://github.com/other/repository",
      }),
    ).toThrow("Trusted workflow profile does not match execution specification");
  });

  it("rejects changed command or argv instead of trusting project-defined execution", () => {
    expect(() =>
      compileWorkflowRequest(workflowId, specification, {
        ...profile,
        allowedChecks: [{ name: "unit", command: "/bin/sh", args: ["-c", "npm test"] }],
      }),
    ).toThrow("Project check is not allowlisted: unit");
  });

  it("rejects a trusted context that differs from the project's approved context", () => {
    expect(() =>
      compileWorkflowRequest(workflowId, specification, {
        ...profile,
        contextSources: [{ path: "src/index.ts", role: "SOURCE" }],
      }),
    ).toThrow("Trusted context sources do not match the approved project profile");
  });

  it("rejects trusted context sources outside configured paths", () => {
    expect(() =>
      compileWorkflowRequest(workflowId, specification, {
        ...profile,
        contextSources: [{ path: "../secrets/token.txt", role: "INSTRUCTION" }],
      }),
    ).toThrow("Context source is outside configured project paths");
  });

  it("rejects a context directory that could include a forbidden descendant", () => {
    expect(() =>
      compileWorkflowRequest(
        workflowId,
        {
          ...specification,
          project: {
            ...specification.project,
            definition: {
              ...specification.project.definition,
              allowedPaths: ["src"],
              forbiddenPaths: ["src/private"],
            },
          },
        },
        {
          ...profile,
          contextSources: [{ path: "src", role: "INSTRUCTION" }],
        },
      ),
    ).toThrow("Context source is outside configured project paths");
  });

  it("rejects invalid trusted runtime settings at the boundary", () => {
    expect(() =>
      compileWorkflowRequest(workflowId, specification, {
        ...profile,
        guardPolicy: { ...profile.guardPolicy, apiFallbackEnabled: true },
      } as unknown as TrustedWorkflowProfile),
    ).toThrow();
  });
});
