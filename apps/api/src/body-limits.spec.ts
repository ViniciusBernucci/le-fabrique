import "reflect-metadata";
import { ARTIFACT_HTTP_MAX_BYTES } from "@le-fabrique/contracts";
import { Body, Controller, Module, Post } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { afterEach, describe, expect, it } from "vitest";
import { configureBodyLimits } from "./body-limits";

class FixtureController {
  receive(body: { value: string }) {
    return { bytes: body.value.length };
  }
}
class FixtureModule {}
Controller("fixture")(FixtureController);
const receiveDescriptor = Object.getOwnPropertyDescriptor(FixtureController.prototype, "receive");
if (!receiveDescriptor) throw new Error("Missing test descriptor");
Post()(FixtureController.prototype, "receive", receiveDescriptor);
Body()(FixtureController.prototype, "receive", 0);
Module({ controllers: [FixtureController] })(FixtureModule);
let app: NestExpressApplication | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});
async function fixtureUrl() {
  app = await NestFactory.create<NestExpressApplication>(FixtureModule, { logger: false });
  configureBodyLimits(app);
  await app.listen(0, "127.0.0.1");
  return `${await app.getUrl()}/fixture`;
}
describe("bounded JSON transport", () => {
  it("accepts JSON above Express's old cap and close to the envelope limit", async () => {
    const url = await fixtureUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(256 * 1024) }),
    });
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ bytes: 256 * 1024 });
    const nearLimit = ARTIFACT_HTTP_MAX_BYTES - 1024;
    const large = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(nearLimit) }),
    });
    expect(large.status).toBe(201);
    expect(await large.json()).toEqual({ bytes: nearLimit });
  });
  it("rejects bodies beyond the shared envelope limit with HTTP 413", async () => {
    const url = await fixtureUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: "x".repeat(ARTIFACT_HTTP_MAX_BYTES) }),
    });
    expect(response.status).toBe(413);
  });
});
