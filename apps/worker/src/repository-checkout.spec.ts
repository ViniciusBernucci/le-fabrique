import { access, lstat, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseRepositoryHosts } from "./config";
import {
  type CheckoutCommandRunner,
  prepareRepositoryCheckout,
  type RepositoryCheckoutInput,
  runCheckoutCommand,
} from "./repository-checkout";

const projectId = "00000000-0000-4000-8000-000000000021";
const workflowId = "00000000-0000-4000-8000-000000000022";
const revision = "a".repeat(40);
const token = "synthetic-gh-secret-for-test";
const inputs: RepositoryCheckoutInput = {
  projectId,
  workflowId,
  repositoryUrl: "https://github.com/example/project.git",
  baseRevision: revision,
};
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  vi.unstubAllEnvs();
});

async function checkoutRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "le-fabrique-checkout-test-"));
  roots.push(root);
  return root;
}

function successfulRunner(
  calls: Array<{
    binary: string;
    args: readonly string[];
    options: Parameters<CheckoutCommandRunner>[2];
  }>,
): CheckoutCommandRunner {
  return async (binary, args, options) => {
    calls.push({ binary, args, options });
    if (binary === "gh") {
      if (args.includes("status")) {
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            hosts: { "github.com": [{ active: true, state: "success", tokenSource: "keyring" }] },
          }),
          stderr: "",
        };
      }
      return { exitCode: 0, stdout: `${token}\n`, stderr: "" };
    }
    const command = args.find((argument) =>
      ["clone", "fetch", "rev-parse", "checkout", "symbolic-ref"].includes(argument),
    );
    if (command === "clone") {
      const destination = args.at(-1);
      if (!destination) throw new Error("fake clone missing destination");
      await mkdir(path.join(destination, ".git"), { recursive: true, mode: 0o700 });
      return { exitCode: 0, stdout: "", stderr: "" };
    }
    if (command === "rev-parse") return { exitCode: 0, stdout: `${revision}\n`, stderr: "" };
    if (command === "symbolic-ref") return { exitCode: 1, stdout: "", stderr: "" };
    return { exitCode: 0, stdout: "", stderr: "" };
  };
}

describe("trusted repository checkout", () => {
  it("parses exact public repository hosts and rejects wildcard/private forms", () => {
    expect(parseRepositoryHosts("github.com, git.example.org")).toEqual([
      "github.com",
      "git.example.org",
    ]);
    expect(() => parseRepositoryHosts("*.github.com")).toThrow();
    expect(() => parseRepositoryHosts("127.0.0.1")).toThrow();
    expect(() => parseRepositoryHosts("github.com,github.com")).toThrow();
  });

  it("clones with a scoped ephemeral credential and publishes the exact detached checkout", async () => {
    const root = await checkoutRoot();
    vi.stubEnv("GH_TOKEN", "must-not-be-inherited");
    const calls: Array<{
      binary: string;
      args: readonly string[];
      options: Parameters<CheckoutCommandRunner>[2];
    }> = [];
    const result = await prepareRepositoryCheckout(
      inputs,
      { root, allowedHosts: ["github.com"] },
      successfulRunner(calls),
    );

    expect(result).toEqual({
      path: path.join(root, projectId, workflowId),
      projectId,
      workflowId,
      repositoryUrl: inputs.repositoryUrl,
      baseRevision: revision,
    });
    expect((await lstat(result.path)).mode & 0o077).toBe(0);
    await expect(access(`${result.path}.lock`)).rejects.toThrow();
    const gitCalls = calls.filter((call) => call.binary === "git");
    expect(gitCalls).toHaveLength(6);
    expect(gitCalls[0]?.args.at(-1)).toMatch(/\.preparing-/);
    expect(gitCalls[1]?.args.at(-1)).toBe(revision);
    expect(gitCalls[2]?.args.at(-1)).toBe(`${revision}^{commit}`);
    expect(gitCalls[3]?.args.at(-1)).toBe(revision);
    expect(gitCalls[4]?.args.at(-1)).toBe("HEAD");
    expect(gitCalls[5]?.args.at(-1)).toBe("HEAD");
    expect(gitCalls[0]?.args).toContain("--no-checkout");
    expect(gitCalls[0]?.args).toContain("--template=/dev/null");
    expect(gitCalls[0]?.args).toContain("protocol.file.allow=never");
    expect(gitCalls[0]?.args).toContain("core.hooksPath=/dev/null");
    expect(gitCalls.every((call) => call.options.environment.GIT_CONFIG_NOSYSTEM === "1")).toBe(
      true,
    );
    expect(gitCalls.every((call) => call.options.environment.GIT_LFS_SKIP_SMUDGE === "1")).toBe(
      true,
    );
    expect(gitCalls.every((call) => !JSON.stringify(call.args).includes(token))).toBe(true);
    expect(gitCalls[0]?.options.environment.GIT_CONFIG_VALUE_0).not.toContain(token);
    expect(
      Buffer.from(
        gitCalls[0]?.options.environment.GIT_CONFIG_VALUE_0.split(" ").at(-1) ?? "",
        "base64",
      ).toString(),
    ).toContain(token);
    const authCall = calls.find((call) => call.binary === "gh");
    expect(authCall?.options.environment.GH_PROMPT_DISABLED).toBe("1");
    expect(authCall?.options.environment.GH_TOKEN).toBeUndefined();
  });

  it("rejects disallowed hosts and credential-bearing URLs before invoking clients", async () => {
    const root = await checkoutRoot();
    const runner = vi.fn<CheckoutCommandRunner>();
    await expect(
      prepareRepositoryCheckout(inputs, { root, allowedHosts: ["git.example.org"] }, runner),
    ).rejects.toThrow("Repository URL is not eligible");
    await expect(
      prepareRepositoryCheckout(
        { ...inputs, repositoryUrl: "https://user:pass@github.com/example/project.git" },
        { root, allowedHosts: ["github.com"] },
        runner,
      ),
    ).rejects.toThrow("Repository URL is not eligible");
    await expect(
      prepareRepositoryCheckout(
        { ...inputs, repositoryUrl: "https://github.com/example/%2e%2e/project.git" },
        { root, allowedHosts: ["github.com"] },
        runner,
      ),
    ).rejects.toThrow("Repository URL is not eligible");
    await expect(
      prepareRepositoryCheckout(
        { ...inputs, baseRevision: "main" },
        { root, allowedHosts: ["github.com"] },
        runner,
      ),
    ).rejects.toThrow("exact lowercase commit SHA");
    expect(runner).not.toHaveBeenCalled();
  });

  it("accepts nested group paths for allowlisted Git hosts", async () => {
    const root = await checkoutRoot();
    const result = await prepareRepositoryCheckout(
      { ...inputs, repositoryUrl: "https://github.com/group/subgroup/project.git" },
      { root, allowedHosts: ["github.com"] },
      successfulRunner([]),
    );
    expect(result.repositoryUrl).toBe("https://github.com/group/subgroup/project.git");
  });

  it("does not extract a Git credential from plaintext or unknown storage", async () => {
    const root = await checkoutRoot();
    const calls: string[][] = [];
    const runner: CheckoutCommandRunner = async (binary, args) => {
      if (binary === "gh") {
        calls.push([...args]);
        return {
          exitCode: 0,
          stdout: JSON.stringify({
            hosts: {
              "github.com": [
                { active: true, state: "success", tokenSource: "/home/worker/hosts.yml" },
              ],
            },
          }),
          stderr: "",
        };
      }
      throw new Error("git must not run without secure credential storage");
    };
    await expect(
      prepareRepositoryCheckout(inputs, { root, allowedHosts: ["github.com"] }, runner),
    ).rejects.toThrow("requires secure official GitHub authentication");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("status");
    expect(calls[0]).not.toContain("token");
  });

  it("fails without a configured root or when a prior destination exists", async () => {
    await expect(
      prepareRepositoryCheckout(inputs, { root: undefined, allowedHosts: ["github.com"] }),
    ).rejects.toThrow("root must be configured");

    const root = await checkoutRoot();
    const destination = path.join(root, projectId, workflowId);
    await mkdir(destination, { recursive: true, mode: 0o700 });
    const runner = vi.fn<CheckoutCommandRunner>();
    await expect(
      prepareRepositoryCheckout(inputs, { root, allowedHosts: ["github.com"] }, runner),
    ).rejects.toThrow("destination already exists");
    expect(runner).not.toHaveBeenCalled();
  });

  it("removes only its temporary checkout and hides command output on failure", async () => {
    const root = await checkoutRoot();
    const calls: Array<{
      binary: string;
      args: readonly string[];
      options: Parameters<CheckoutCommandRunner>[2];
    }> = [];
    const fake = successfulRunner(calls);
    const runner: CheckoutCommandRunner = async (binary, args, options) => {
      const result = await fake(binary, args, options);
      if (binary === "git" && args.includes("clone")) {
        return { exitCode: 1, stdout: "private-ref", stderr: "private-error" };
      }
      return result;
    };

    await expect(
      prepareRepositoryCheckout(inputs, { root, allowedHosts: ["github.com"] }, runner),
    ).rejects.toThrow("Trusted repository checkout failed during clone");
    const temporary = calls.find((call) => call.binary === "git")?.args.at(-1);
    expect(temporary).toBeDefined();
    await expect(access(temporary as string)).rejects.toThrow();
    await expect(access(path.join(root, projectId, workflowId))).rejects.toThrow();
    await expect(access(`${path.join(root, projectId, workflowId)}.lock`)).rejects.toThrow();
  });

  it("never publishes when the fetched object does not match the requested SHA", async () => {
    const root = await checkoutRoot();
    const calls: Array<{
      binary: string;
      args: readonly string[];
      options: Parameters<CheckoutCommandRunner>[2];
    }> = [];
    const fake = successfulRunner(calls);
    const runner: CheckoutCommandRunner = async (binary, args, options) => {
      if (
        binary === "git" &&
        args.includes("rev-parse") &&
        args.at(-1) === `${revision}^{commit}`
      ) {
        calls.push({ binary, args, options });
        return { exitCode: 0, stdout: `${"b".repeat(40)}\n`, stderr: "" };
      }
      return fake(binary, args, options);
    };

    await expect(
      prepareRepositoryCheckout(inputs, { root, allowedHosts: ["github.com"] }, runner),
    ).rejects.toThrow("resolved a different commit");
    expect(calls.some((call) => call.binary === "git" && call.args.includes("checkout"))).toBe(
      false,
    );
    await expect(access(path.join(root, projectId, workflowId))).rejects.toThrow();
    const temporary = calls
      .find((call) => call.binary === "git" && call.args.includes("clone"))
      ?.args.at(-1);
    expect(temporary).toBeDefined();
    await expect(access(temporary as string)).rejects.toThrow();
  });

  it("kills a timed-out process group and waits for process close", async () => {
    await expect(
      runCheckoutCommand(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], {
        cwd: process.cwd(),
        environment: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
        timeoutMs: 30,
        maxOutputBytes: 1024,
      }),
    ).rejects.toThrow("timed out");
  });

  it("kills a canceled process and reports cancellation only after close", async () => {
    const controller = new AbortController();
    const command = runCheckoutCommand(process.execPath, ["-e", "setTimeout(() => {}, 5000)"], {
      cwd: process.cwd(),
      environment: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      timeoutMs: 5000,
      maxOutputBytes: 1024,
      signal: controller.signal,
    });
    setTimeout(() => controller.abort(), 30);
    await expect(command).rejects.toThrow("was canceled");
  });
});
