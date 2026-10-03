/** Sequential requests with cancellation; late replies never update an abandoned view. */
export function pollResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  onValue: (value: T) => void,
  onError: () => void,
  intervalMs = 10_000,
): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const poll = async () => {
    try {
      const result = await load(controller.signal);
      if (!controller.signal.aborted) onValue(result);
    } catch {
      if (!controller.signal.aborted) onError();
    } finally {
      if (!controller.signal.aborted) timer = setTimeout(() => void poll(), intervalMs);
    }
  };
  void poll();
  return () => {
    controller.abort();
    if (timer) clearTimeout(timer);
  };
}
