export interface LeaseGuardOptions {
  fencingToken: number;
  leaseDurationMs: number;
  initialLeaseExpiresAt: string;
  renew: (fencingToken: number) => Promise<{ leaseExpiresAt: string }>;
  stopWriter: () => Promise<boolean>;
  renewalIntervalMs?: number;
}

export class LeaseAuthorityLostError extends Error {
  constructor(readonly writerQuiescent: boolean) {
    super(
      writerQuiescent
        ? "Lease authority was lost; writer stop was confirmed"
        : "Lease authority was lost; writer quiescence was not confirmed",
    );
    this.name = "LeaseAuthorityLostError";
  }
}

/** Keeps a fencing-token-bound lease alive and fails closed when renewal is lost. */
export class LeaseGuard {
  private readonly renewalIntervalMs: number;

  constructor(private readonly options: LeaseGuardOptions) {
    const { fencingToken, leaseDurationMs, initialLeaseExpiresAt, renewalIntervalMs } = options;
    const expiresAt = Date.parse(initialLeaseExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new Error("Initial lease expiry must be a future timestamp");
    }
    this.renewalIntervalMs = renewalIntervalMs ?? Math.floor(leaseDurationMs / 3);
    if (
      !Number.isSafeInteger(leaseDurationMs) ||
      leaseDurationMs < 15_000 ||
      leaseDurationMs > 300_000 ||
      !Number.isSafeInteger(fencingToken) ||
      fencingToken <= 0 ||
      !Number.isSafeInteger(this.renewalIntervalMs) ||
      this.renewalIntervalMs <= 0 ||
      this.renewalIntervalMs >= leaseDurationMs
    ) {
      throw new Error("Lease duration and renewal interval are invalid");
    }
  }

  async execute<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controller = new AbortController();
    let leaseExpiresAt = Date.parse(this.options.initialLeaseExpiresAt);
    let stopped = false;
    let lost: LeaseAuthorityLostError | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let renewal: Promise<void> | undefined;

    const loseAuthority = async (): Promise<void> => {
      if (lost) return;
      controller.abort();
      let quiescent = false;
      try {
        quiescent = await this.options.stopWriter();
      } catch {
        quiescent = false;
      }
      lost = new LeaseAuthorityLostError(quiescent);
    };

    const schedule = (): void => {
      if (stopped || lost) return;
      const delay = Math.min(this.renewalIntervalMs, Math.max(0, leaseExpiresAt - Date.now()));
      timer = setTimeout(() => {
        if (stopped || lost) return;
        const remainingMs = leaseExpiresAt - Date.now();
        if (remainingMs <= 0) {
          renewal = loseAuthority();
          return;
        }

        let deadline: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<never>((_, reject) => {
          deadline = setTimeout(
            () => reject(new Error("Lease renewal deadline elapsed")),
            remainingMs,
          );
        });
        renewal = Promise.race([
          Promise.resolve().then(() => this.options.renew(this.options.fencingToken)),
          timeout,
        ])
          .then(({ leaseExpiresAt: nextExpiry }) => {
            const parsedExpiry = Date.parse(nextExpiry);
            if (!Number.isFinite(parsedExpiry) || parsedExpiry <= Date.now()) {
              throw new Error("Lease renewal returned an expired lease");
            }
            leaseExpiresAt = parsedExpiry;
          })
          .catch(loseAuthority)
          .finally(() => {
            if (deadline) clearTimeout(deadline);
            renewal = undefined;
            schedule();
          });
      }, delay);
    };

    schedule();
    let result: T | undefined;
    let operationError: unknown;
    let operationFailed = false;
    try {
      result = await operation(controller.signal);
    } catch (error) {
      operationError = error;
      operationFailed = true;
    }

    stopped = true;
    if (timer) clearTimeout(timer);
    await renewal;
    if (lost) throw lost;
    if (operationFailed) throw operationError;
    return result as T;
  }
}
