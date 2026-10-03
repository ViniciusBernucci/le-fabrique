import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const require = createRequire(import.meta.url);
const { Queue, Worker } = require("bullmq");
const { OutboxDispatcher } = require("../apps/api/dist/orchestration/outbox-dispatcher.js");
const { FactorySchedulingPausedError } = require("../apps/worker/dist/control-client.js");
const { deferFactoryPausedExecution } = require("../apps/worker/dist/factory-pause.js");
const container = `fac-012ag-redis-${randomUUID()}`;
let created = false;
let connection;
async function until(check) {
  for (let count = 0; count < 100; count++) {
    if (await check()) return;
    await delay(25);
  }
  throw new Error("Isolated Redis test did not reach expected state");
}
before(async () => {
  execFileSync("docker", ["image", "inspect", "redis:8.4.0-alpine"], { stdio: "ignore" });
  execFileSync(
    "docker",
    [
      "run",
      "--detach",
      "--rm",
      "--name",
      container,
      "--memory",
      "128m",
      "--cpus",
      "0.5",
      "--publish",
      "127.0.0.1::6379",
      "redis:8.4.0-alpine",
      "redis-server",
      "--save",
      "",
      "--appendonly",
      "no",
    ],
    { stdio: "ignore", timeout: 20_000 },
  );
  created = true;
  const mapping = execFileSync("docker", ["port", container, "6379/tcp"]).toString().trim();
  const port = Number(mapping.match(/:(\d+)$/)?.[1]);
  assert.ok(port > 0);
  connection = { host: "127.0.0.1", port, maxRetriesPerRequest: null };
  await until(async () => {
    try {
      return (
        execFileSync("docker", ["exec", container, "redis-cli", "ping"], {
          timeout: 1000,
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim() === "PONG"
      );
    } catch {
      return false;
    }
  });
});
after(() => {
  if (created)
    execFileSync("docker", ["rm", "--force", container], { stdio: "ignore", timeout: 20_000 });
});

test("dispatcher pauses a real BullMQ queue and resumes preserved jobs without duplicate dispatch", async () => {
  const queueName = `factory-pause-${randomUUID()}`;
  const queue = new Queue(queueName, { connection });
  let paused = true;
  let published = false;
  let completed = 0;
  const projectId = randomUUID();
  const ticketId = randomUUID();
  const eventId = randomUUID();
  const payload = {
    projectId,
    ticketId,
    ticketVersion: 2,
    baseRevision: "a".repeat(40),
    projectDefinitionVersion: 1,
    executionSpecification: {
      schemaVersion: 1,
      project: {
        id: projectId,
        name: "synthetic",
        repoUrl: "https://example.invalid/synthetic.git",
        baseRevision: "a".repeat(40),
        definitionVersion: 1,
        definition: {
          summary: "synthetic",
          externalStack: "synthetic",
          instructions: "synthetic",
          allowedPaths: ["src"],
          forbiddenPaths: [],
          checks: [{ name: "synthetic", command: "/usr/bin/true", args: [] }],
        },
      },
      ticket: {
        id: ticketId,
        version: 2,
        title: "synthetic",
        objective: "synthetic",
        acceptanceCriteria: ["synthetic"],
      },
    },
  };
  const prisma = {
    factoryOperation: { findUnique: async () => ({ paused }) },
    outboxEvent: {
      findMany: async () =>
        published ? [] : [{ id: eventId, eventType: "ticket.ready.v1", attempts: 0, payload }],
      updateMany: async () => {
        published = true;
        return { count: 1 };
      },
    },
  };
  const dispatcher = new OutboxDispatcher(prisma, queue);
  let worker;
  try {
    assert.equal(await dispatcher.dispatchOnce(), 0);
    assert.equal(await queue.isPaused(), true);
    assert.equal(published, false);
    await queue.add("preserved-before-pause", { synthetic: true }, { jobId: randomUUID() });
    worker = new Worker(
      queueName,
      async () => {
        completed++;
        return { synthetic: true };
      },
      { connection, concurrency: 1 },
    );
    await delay(100);
    assert.equal(completed, 0);
    paused = false;
    assert.equal(await dispatcher.dispatchOnce(), 1);
    await until(() => completed === 2);
    assert.equal(await dispatcher.dispatchOnce(), 0);
    assert.equal(completed, 2);
  } finally {
    await worker?.close();
    await queue.close();
  }
});

test("pre-claim pause moves a real active job to delayed without attemptsMade or failed state", async () => {
  const queueName = `factory-gap-${randomUUID()}`;
  const queue = new Queue(queueName, { connection });
  let paused = true;
  let executed = 0;
  let failed = 0;
  const worker = new Worker(
    queueName,
    (job, token) =>
      deferFactoryPausedExecution(
        async () => {
          if (paused) throw new FactorySchedulingPausedError();
          executed++;
          return { synthetic: true };
        },
        () => job.moveToDelayed(Date.now() + 300, token),
      ),
    { connection, concurrency: 1 },
  );
  worker.on("failed", () => {
    failed++;
  });
  try {
    const job = await queue.add(
      "synthetic-gap",
      {},
      { jobId: randomUUID(), removeOnComplete: false, removeOnFail: false },
    );
    await until(async () => (await job.getState()) === "delayed");
    await queue.pause();
    assert.equal((await queue.getJob(job.id)).attemptsMade, 0);
    assert.equal(executed, 0);
    assert.equal(failed, 0);
    paused = false;
    await queue.resume();
    await until(async () => (await job.getState()) === "completed");
    assert.equal(executed, 1);
    assert.equal(failed, 0);
    assert.equal((await queue.getJob(job.id)).attemptsMade, 1);
  } finally {
    await worker.close();
    await queue.close();
  }
});
