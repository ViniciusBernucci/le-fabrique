import { DelayedError } from "bullmq";
import { WriterAdmissionDeferredError } from "./control-client";

/** Only known pre-claim pause/capacity refusal is delayed; execution/authority failures never become blind retries. */
export async function deferWriterAdmission<T>(
  execute: () => Promise<T>,
  defer: () => Promise<void>,
): Promise<T> {
  try {
    return await execute();
  } catch (error) {
    if (!(error instanceof WriterAdmissionDeferredError)) throw error;
    await defer();
    throw new DelayedError();
  }
}

export const deferFactoryPausedExecution = deferWriterAdmission;
