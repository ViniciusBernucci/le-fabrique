import { DelayedError } from "bullmq";
import { expect, it, vi } from "vitest";
import {
  ControlRequestError,
  FactorySchedulingPausedError,
  WriterAdmissionDeferredError,
} from "./control-client";
import { deferFactoryPausedExecution } from "./factory-pause";

it("delays only known pre-claim factory pause without declaring job success or failure", async () => {
  const defer = vi.fn().mockResolvedValue(undefined);
  const execute = vi.fn().mockRejectedValue(new FactorySchedulingPausedError());
  await expect(deferFactoryPausedExecution(execute, defer)).rejects.toBeInstanceOf(DelayedError);
  expect(defer).toHaveBeenCalledOnce();
  expect(execute).toHaveBeenCalledOnce();
});
it("never delays authority, execution or interruption failures", async () => {
  const defer = vi.fn();
  const error = new Error("synthetic unknown writer termination");
  await expect(
    deferFactoryPausedExecution(async () => {
      throw error;
    }, defer),
  ).rejects.toBe(error);
  expect(defer).not.toHaveBeenCalled();
});
it("does not fabricate delayed status if queue deferral itself fails", async () => {
  const error = new Error("synthetic Redis failure");
  await expect(
    deferFactoryPausedExecution(
      async () => {
        throw new FactorySchedulingPausedError();
      },
      async () => {
        throw error;
      },
    ),
  ).rejects.toBe(error);
});
it("returns completed/recovered metadata normally without moving jobs", async () => {
  const defer = vi.fn();
  expect(await deferFactoryPausedExecution(async () => ({ recovered: true }), defer)).toEqual({
    recovered: true,
  });
  expect(defer).not.toHaveBeenCalled();
});

it("preserves capacity-blocked jobs through the same pre-claim deferral", async () => {
  const defer = vi.fn().mockResolvedValue(undefined);
  await expect(
    deferFactoryPausedExecution(async () => {
      throw new WriterAdmissionDeferredError();
    }, defer),
  ).rejects.toBeInstanceOf(DelayedError);
  expect(defer).toHaveBeenCalledOnce();
});
it("does not defer generic 429 failures after admission", async () => {
  const defer = vi.fn();
  const error = new ControlRequestError(429);
  await expect(
    deferFactoryPausedExecution(async () => {
      throw error;
    }, defer),
  ).rejects.toBe(error);
  expect(defer).not.toHaveBeenCalled();
});
