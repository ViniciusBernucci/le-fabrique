export interface RuntimeLimits {
  timeoutMs: number;
  maxAttempts: number;
  maxLogBytes: number;
}

export interface RuntimeAdapter {
  readonly name: string;
  getCapabilities(): Promise<readonly string[]>;
}
