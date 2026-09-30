import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import type { SandboxCommandRequest } from "@le-fabrique/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SandboxRunner } from "./sandbox-runner";

let workspace = "";

function request(overrides: Partial<SandboxCommandRequest> = {}): SandboxCommandRequest {
  return {
    schemaVersion: 1,
    executionId: crypto.randomUUID(),
    workspacePath: workspace,
    command: process.execPath,
    args: ["/mnt/probe.cjs"],
    environment: { CI: "true" },
    limits: {
      timeoutMs: 5_000,
      maxLogBytes: 16_384,
      memoryBytes: 256 * 1024 * 1024,
      cpuQuotaPercent: 100,
      maxProcesses: 64,
      maxOpenFiles: 256,
      maxFileBytes: 16 * 1024 * 1024,
    },
    ...overrides,
  };
}

beforeEach(async () => {
  workspace = await mkdtemp(resolve(tmpdir(), "le-fabrique-sandbox-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("SandboxRunner Linux integration", () => {
  it("hides host home, Docker socket, inherited keys and external network", async () => {
    await writeFile(
      resolve(workspace, "probe.cjs"),
      `
const fs = require("node:fs");
const net = require("node:net");
const result = {
  cwd: process.cwd(),
  authReadable: fs.existsSync("/home/vinicius/.codex/auth.json"),
  controlVisible: fs.existsSync("/home/vinicius/le-fabrique"),
  dockerSocketVisible: fs.existsSync("/var/run/docker.sock"),
  inheritedKey: typeof process.env.OPENAI_API_KEY !== "undefined",
  ci: process.env.CI,
  networkBlocked: false,
};
const cgroup = fs.readFileSync("/proc/self/cgroup", "utf8").trim().split("::")[1];
const cgroupRoot = "/sys/fs/cgroup" + cgroup;
result.memoryMax = fs.readFileSync(cgroupRoot + "/memory.max", "utf8").trim();
result.processMax = fs.readFileSync(cgroupRoot + "/pids.max", "utf8").trim();
const socket = net.connect({ host: "1.1.1.1", port: 53 });
socket.setTimeout(500);
socket.on("connect", () => { socket.destroy(); console.log(JSON.stringify(result)); });
socket.on("timeout", () => { result.networkBlocked = true; socket.destroy(); console.log(JSON.stringify(result)); });
socket.on("error", () => { result.networkBlocked = true; console.log(JSON.stringify(result)); });
`,
    );
    process.env.OPENAI_API_KEY = "synthetic-must-not-reach-sandbox";
    try {
      const result = await new SandboxRunner().execute(request());
      expect(result.status).toBe("COMPLETED");
      expect(result.stoppedConfirmed).toBe(true);
      expect(JSON.parse(result.stdout.trim())).toEqual({
        cwd: "/mnt",
        authReadable: false,
        controlVisible: false,
        dockerSocketVisible: false,
        inheritedKey: false,
        ci: "true",
        networkBlocked: true,
        memoryMax: String(256 * 1024 * 1024),
        processMax: "64",
      });
      expect(result.stdout).not.toContain("synthetic-must-not-reach-sandbox");
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  }, 15_000);

  it("kills the complete cgroup after timeout", async () => {
    await writeFile(
      resolve(workspace, "timeout.cjs"),
      `
const fs = require("node:fs");
const { spawn } = require("node:child_process");
spawn(process.execPath, ["-e", 'setInterval(() => require("node:fs").appendFileSync("/mnt/heartbeat", "x"), 20)']);
fs.writeFileSync("/mnt/started", "yes");
setInterval(() => {}, 1000);
`,
    );
    const result = await new SandboxRunner({ killGraceMs: 100 }).execute(
      request({ args: ["/mnt/timeout.cjs"], limits: { ...request().limits, timeoutMs: 1_000 } }),
    );
    expect(result).toMatchObject({ status: "TIMED_OUT", stoppedConfirmed: true });
    expect(await readFile(resolve(workspace, "started"), "utf8")).toBe("yes");
    const sizeAfterStop = (await stat(resolve(workspace, "heartbeat"))).size;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 150));
    expect((await stat(resolve(workspace, "heartbeat"))).size).toBe(sizeAfterStop);
  }, 15_000);

  it("rejects arbitrary environment keys before starting a unit", async () => {
    await expect(
      new SandboxRunner().execute(request({ environment: { OPENAI_API_KEY: "denied" } })),
    ).rejects.toThrow("environment key denied");
  });
});
