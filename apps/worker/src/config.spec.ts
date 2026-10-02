import { describe, expect, it } from "vitest";
import { loadWorkerConfig, parseRepositoryHosts } from "./config";

const workerEnvironment = {
  NODE_ENV: "test",
  REDIS_URL: "redis://localhost:6379",
  WORKER_CONCURRENCY: "1",
  CONTROL_API_URL: "http://localhost:3000/api",
  WORKER_API_TOKEN: "synthetic-worker-token-at-least-32-characters-long",
  WORKER_ID: "00000000-0000-4000-8000-000000000001",
  WORKER_NAME: "synthetic-worker",
};

describe("worker configuration", () => {
  it("accepts an explicit absolute checkout root and exact repository host list", () => {
    const config = loadWorkerConfig({
      ...workerEnvironment,
      WORKER_CHECKOUT_ROOT: "/srv/le-fabrique/checkouts",
      WORKER_REPOSITORY_HOSTS: "github.com,git.example.org",
    });
    expect(config.WORKER_CHECKOUT_ROOT).toBe("/srv/le-fabrique/checkouts");
    expect(config.WORKER_REPOSITORY_HOSTS).toEqual(["github.com", "git.example.org"]);
  });

  it("leaves checkout disabled in configuration until a root and host are supplied", () => {
    const config = loadWorkerConfig(workerEnvironment);
    expect(config.WORKER_CHECKOUT_ROOT).toBeUndefined();
    expect(config.WORKER_REPOSITORY_HOSTS).toEqual([]);
  });

  it("rejects relative roots, wildcard hosts and malformed DNS names", () => {
    expect(() =>
      loadWorkerConfig({ ...workerEnvironment, WORKER_CHECKOUT_ROOT: "checkouts" }),
    ).toThrow();
    expect(() => parseRepositoryHosts("*.github.com")).toThrow();
    expect(() => parseRepositoryHosts("localhost")).toThrow();
    expect(() => parseRepositoryHosts("127.0.0.1")).toThrow();
  });
});
