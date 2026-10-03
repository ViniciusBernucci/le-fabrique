import { DelayedError } from "bullmq";
import { FactorySchedulingPausedError } from "./control-client";

/** Only pre-claim pause is delayed; execution/authority failures never become blind retries. */
export async function deferFactoryPausedExecution<T>(
  execute: () => Promise<T>,
  defer: () => Promise<void>,
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (!(error instanceof FactorySchedulingPausedError)) throw error;
    await defer();
    throw new DelayedError();
  }
}
