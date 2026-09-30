import type {
  ProviderStatus,
  ProviderUsageObservation,
  RuntimeCancelResult,
  RuntimeEvent,
  RuntimeExecutionRequest,
  RuntimeExecutionResult,
} from "@le-fabrique/contracts";

export type RuntimeEventSink = (event: RuntimeEvent) => void;

export interface RuntimeAdapter {
  readonly name: "codex";
  execute(
    request: RuntimeExecutionRequest,
    eventSink?: RuntimeEventSink,
  ): Promise<RuntimeExecutionResult>;
  cancel(executionId: string): Promise<RuntimeCancelResult>;
  getStatus(): Promise<ProviderStatus>;
  getCapabilities(): Promise<readonly string[]>;
  getUsage(): Promise<ProviderUsageObservation>;
}
