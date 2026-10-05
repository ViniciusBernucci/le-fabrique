import { describe, expect, it, vi } from "vitest";
import {
  inspectGithubRepository,
  processGithubRepositoryVerification,
} from "./github-repository-verification.processor";

const target = {
  host: "github.com",
  owner: "fixture-owner",
  repository: "fixture-repository",
  baseBranch: "feature/read-only",
};

describe("GitHub repository verification", () => {
  it("uses only authenticated GET requests and accepts exact readable evidence", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          fullName: "fixture-owner/fixture-repository",
          defaultBranch: "main",
          isPrivate: true,
          isArchived: false,
          canRead: true,
        }),
        stderr: "private diagnostic",
      })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({ name: "feature/read-only" }),
        stderr: "",
      });

    await expect(inspectGithubRepository(target, runner)).resolves.toEqual({
      status: "COMPLETED",
      access: "READABLE",
      observedOwner: "fixture-owner",
      observedRepository: "fixture-repository",
      defaultBranch: "main",
      observedBaseBranch: "feature/read-only",
      isPrivate: true,
      isArchived: false,
      message: "GitHub repository and configured base branch are readable",
    });
    expect(runner).toHaveBeenCalledTimes(2);
    for (const [binary, args] of runner.mock.calls) {
      expect(binary).toBe("gh");
      expect(args).toContain("GET");
      expect(args).not.toContain("POST");
      expect(args).not.toContain("--input");
      expect(args).not.toContain("--field");
    }
    expect(runner.mock.calls[1]?.[1]).toContain(
      "repos/fixture-owner/fixture-repository/branches/feature%2Fread-only",
    );
  });

  it("fails closed when read permission, identity or branch evidence is absent", async () => {
    const cases = [
      {
        fullName: "fixture-owner/fixture-repository",
        defaultBranch: "main",
        isPrivate: true,
        isArchived: false,
        canRead: false,
      },
      {
        fullName: "other-owner/fixture-repository",
        defaultBranch: "main",
        isPrivate: true,
        isArchived: false,
        canRead: true,
      },
    ];
    for (const metadata of cases) {
      const result = await inspectGithubRepository(
        target,
        vi.fn().mockResolvedValue({
          exitCode: 0,
          stdout: JSON.stringify(metadata),
          stderr: "token=must-not-return",
        }),
      );
      expect(result).toMatchObject({ status: "FAILED", access: "UNAVAILABLE" });
      expect(JSON.stringify(result)).not.toContain("must-not-return");
      expect(result.observedOwner).toBeNull();
    }
  });

  it("does not return partial metadata when the configured branch is unavailable", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify({
          fullName: "fixture-owner/fixture-repository",
          defaultBranch: "main",
          isPrivate: false,
          isArchived: false,
          canRead: true,
        }),
        stderr: "",
      })
      .mockResolvedValueOnce({ exitCode: 1, stdout: "", stderr: "secret diagnostic" });
    await expect(inspectGithubRepository(target, runner)).resolves.toEqual({
      status: "FAILED",
      access: "UNAVAILABLE",
      observedOwner: null,
      observedRepository: null,
      defaultBranch: null,
      observedBaseBranch: null,
      isPrivate: null,
      isArchived: null,
      message: "GitHub repository read verification failed without persisted output",
    });
  });

  it("starts and completes through the authenticated worker protocol", async () => {
    const control = {
      startGithubRepositoryVerification: vi.fn().mockResolvedValue({}),
      completeGithubRepositoryVerification: vi.fn().mockResolvedValue({ status: "FAILED" }),
    };
    const job = {
      schemaVersion: 1 as const,
      eventId: crypto.randomUUID(),
      verificationId: crypto.randomUUID(),
      ...target,
    };
    await processGithubRepositoryVerification(
      job,
      control as never,
      vi.fn().mockResolvedValue({ exitCode: 1, stdout: "", stderr: "" }),
    );
    expect(control.startGithubRepositoryVerification).toHaveBeenCalledWith(job.verificationId);
    expect(control.completeGithubRepositoryVerification).toHaveBeenCalledWith(
      job.verificationId,
      expect.objectContaining({ status: "FAILED", access: "UNAVAILABLE" }),
    );
  });
});
