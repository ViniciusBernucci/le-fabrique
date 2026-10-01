import type {
  CompleteGithubRepositoryVerification,
  GithubRepositoryVerificationJob,
} from "@le-fabrique/contracts";
import { githubRepositoryVerificationJobSchema } from "@le-fabrique/contracts";
import type { ControlClient } from "./control-client";
import { runGithubCommand } from "./github-verification.processor";

type CommandResult = { exitCode: number | null; stdout: string; stderr: string };
type Runner = (binary: string, args: readonly string[]) => Promise<CommandResult>;

const repositoryFilter =
  "{fullName: .full_name, defaultBranch: .default_branch, isPrivate: .private, isArchived: .archived, canRead: .permissions.pull}";
const branchFilter = "{name: .name}";

function endpointSegment(value: string): string {
  return encodeURIComponent(value);
}

function parseObject(output: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(output);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("GitHub API output is not an object");
  }
  return parsed as Record<string, unknown>;
}

function stringField(object: Record<string, unknown>, field: string, max: number): string {
  const value = object[field];
  if (typeof value !== "string" || value.length < 1 || value.length > max) {
    throw new Error(`GitHub API ${field} is invalid`);
  }
  return value;
}

function booleanField(object: Record<string, unknown>, field: string): boolean {
  const value = object[field];
  if (typeof value !== "boolean") throw new Error(`GitHub API ${field} is invalid`);
  return value;
}

function failedResult(): Omit<CompleteGithubRepositoryVerification, "workerId"> {
  return {
    status: "FAILED",
    access: "UNAVAILABLE",
    observedOwner: null,
    observedRepository: null,
    defaultBranch: null,
    observedBaseBranch: null,
    isPrivate: null,
    isArchived: null,
    message: "GitHub repository read verification failed without persisted output",
  };
}

export async function inspectGithubRepository(
  target: Pick<GithubRepositoryVerificationJob, "host" | "owner" | "repository" | "baseBranch">,
  runner: Runner = runGithubCommand,
): Promise<Omit<CompleteGithubRepositoryVerification, "workerId">> {
  try {
    const owner = endpointSegment(target.owner);
    const repository = endpointSegment(target.repository);
    const repositoryResult = await runner("gh", [
      "api",
      "--hostname",
      target.host,
      "--method",
      "GET",
      `repos/${owner}/${repository}`,
      "--jq",
      repositoryFilter,
    ]);
    if (repositoryResult.exitCode !== 0) return failedResult();
    const metadata = parseObject(repositoryResult.stdout);
    const fullName = stringField(metadata, "fullName", 201);
    const separator = fullName.indexOf("/");
    if (separator < 1 || separator !== fullName.lastIndexOf("/")) {
      throw new Error("GitHub repository identity is invalid");
    }
    const observedOwner = fullName.slice(0, separator);
    const observedRepository = fullName.slice(separator + 1);
    const defaultBranch = stringField(metadata, "defaultBranch", 200);
    const isPrivate = booleanField(metadata, "isPrivate");
    const isArchived = booleanField(metadata, "isArchived");
    const canRead = booleanField(metadata, "canRead");
    if (
      !canRead ||
      observedOwner.toLowerCase() !== target.owner.toLowerCase() ||
      observedRepository.toLowerCase() !== target.repository.toLowerCase()
    ) {
      return failedResult();
    }

    const branchResult = await runner("gh", [
      "api",
      "--hostname",
      target.host,
      "--method",
      "GET",
      `repos/${owner}/${repository}/branches/${endpointSegment(target.baseBranch)}`,
      "--jq",
      branchFilter,
    ]);
    if (branchResult.exitCode !== 0) return failedResult();
    const observedBaseBranch = stringField(parseObject(branchResult.stdout), "name", 200);
    if (observedBaseBranch !== target.baseBranch) return failedResult();

    return {
      status: "COMPLETED",
      access: "READABLE",
      observedOwner,
      observedRepository,
      defaultBranch,
      observedBaseBranch,
      isPrivate,
      isArchived,
      message: "GitHub repository and configured base branch are readable",
    };
  } catch {
    return failedResult();
  }
}

export async function processGithubRepositoryVerification(
  untrustedJob: GithubRepositoryVerificationJob,
  control: ControlClient,
  runner: Runner = runGithubCommand,
) {
  const job = githubRepositoryVerificationJobSchema.parse(untrustedJob);
  await control.startGithubRepositoryVerification(job.verificationId);
  const result = await inspectGithubRepository(job, runner);
  return control.completeGithubRepositoryVerification(job.verificationId, result);
}
