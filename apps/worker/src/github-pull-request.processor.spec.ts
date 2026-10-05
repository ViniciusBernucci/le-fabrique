import { describe, expect, it, vi } from "vitest";
import { createGithubPullRequest, processGithubPullRequest } from "./github-pull-request.processor";

const job = {
  schemaVersion: 1 as const,
  eventId: "11111111-1111-4111-8111-111111111111",
  requestId: "22222222-2222-4222-8222-222222222222",
  approvalDigest: "a".repeat(64),
  host: "github.com",
  owner: "fixture-owner",
  repository: "fixture-repository",
  baseBranch: "main",
  headBranch: "feature/gated-pr",
  title: "Create gated pull request",
  body: "Synthetic body",
  draft: true,
};

const permission = {
  exitCode: 0,
  stdout: JSON.stringify({ fullName: "fixture-owner/fixture-repository", canPush: true }),
  stderr: "",
};

describe("GitHub pull request processor", () => {
  it("checks write permission and reuses an exact same-repository open PR", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(permission)
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: JSON.stringify([
          {
            number: 17,
            url: "https://github.com/fixture-owner/fixture-repository/pull/17",
            headRefName: "feature/gated-pr",
            baseRefName: "main",
            isCrossRepository: false,
          },
        ]),
        stderr: "",
      });
    await expect(createGithubPullRequest(job, runner)).resolves.toMatchObject({
      status: "COMPLETED",
      disposition: "EXISTING",
      pullRequestNumber: 17,
    });
    expect(runner).toHaveBeenCalledTimes(2);
  });

  it("creates only after permission and reconciliation using explicit safe argv and stdin", async () => {
    const runner = vi
      .fn()
      .mockResolvedValueOnce(permission)
      .mockResolvedValueOnce({ exitCode: 0, stdout: "[]", stderr: "" })
      .mockResolvedValueOnce({
        exitCode: 0,
        stdout: "https://github.com/fixture-owner/fixture-repository/pull/18\n",
        stderr: "private diagnostic",
      });
    await expect(createGithubPullRequest(job, runner)).resolves.toMatchObject({
      status: "COMPLETED",
      disposition: "CREATED",
      pullRequestNumber: 18,
    });
    const createCall = runner.mock.calls[2];
    expect(createCall?.[0]).toBe("gh");
    expect(createCall?.[1]).toEqual([
      "pr",
      "create",
      "--repo",
      "github.com/fixture-owner/fixture-repository",
      "--base",
      "main",
      "--head",
      "feature/gated-pr",
      "--title",
      "Create gated pull request",
      "--body-file",
      "-",
      "--draft",
    ]);
    expect(createCall?.[2]).toBe("Synthetic body");
    expect(createCall?.[1]).not.toContain("merge");
    expect(createCall?.[1]).not.toContain("push");
  });

  it("fails before create when push permission is unavailable", async () => {
    const runner = vi.fn().mockResolvedValue({
      exitCode: 0,
      stdout: JSON.stringify({ fullName: "fixture-owner/fixture-repository", canPush: false }),
      stderr: "token=must-not-return",
    });
    const result = await createGithubPullRequest(job, runner);
    expect(result).toEqual({
      status: "FAILED",
      disposition: null,
      pullRequestNumber: null,
      pullRequestUrl: null,
      message: "GitHub repository write permission is unavailable",
    });
    expect(runner).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("must-not-return");
  });

  it("uses the authenticated worker protocol", async () => {
    const control = {
      startGithubPullRequest: vi.fn().mockResolvedValue({}),
      completeGithubPullRequest: vi.fn().mockResolvedValue({ status: "FAILED" }),
    };
    await processGithubPullRequest(
      job,
      control as never,
      vi.fn().mockResolvedValue({ exitCode: 1, stdout: "", stderr: "" }),
    );
    expect(control.startGithubPullRequest).toHaveBeenCalledWith(job.requestId);
    expect(control.completeGithubPullRequest).toHaveBeenCalledWith(
      job.requestId,
      expect.objectContaining({ status: "FAILED" }),
    );
  });
});
