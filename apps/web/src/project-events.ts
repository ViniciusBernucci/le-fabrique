import { type ProjectEvent, projectEventSchema } from "@le-fabrique/contracts";

/** Bounded SSE decoder; identifiers and payload project are verified before delivery. */
export class ProjectEventDecoder {
  private buffer = "";
  private sequence: bigint;
  constructor(
    private readonly projectId: string,
    after = "0",
  ) {
    this.sequence = BigInt(after);
  }
  get cursor() {
    return this.sequence.toString();
  }
  push(chunk: string): ProjectEvent[] {
    this.buffer = (this.buffer + chunk).replace(/\r\n/g, "\n");
    if (this.buffer.length > 65_536) throw new Error("Project event buffer exceeded");
    const events: ProjectEvent[] = [];
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const frame = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      if (frame.length > 16_384) throw new Error("Project event frame exceeded");
      let type = "message";
      let id = "";
      const data: string[] = [];
      for (const line of frame.split("\n")) {
        const colon = line.indexOf(":");
        if (colon < 0 || colon === 0) continue;
        const field = line.slice(0, colon);
        const value = line.slice(colon + 1).replace(/^ /, "");
        if (field === "event") type = value;
        if (field === "id") id = value;
        if (field === "data") data.push(value);
      }
      if (type === "project-change") {
        const event = projectEventSchema.parse(JSON.parse(data.join("\n")));
        if (event.projectId !== this.projectId || event.sequence !== id)
          throw new Error("Project event identity mismatch");
        const next = BigInt(event.sequence);
        if (next > this.sequence) {
          this.sequence = next;
          events.push(event);
        }
      } else if (type !== "heartbeat" && data.length > 0) {
        throw new Error("Unexpected project event type");
      }
      boundary = this.buffer.indexOf("\n\n");
    }
    return events;
  }
}

/** Bearer stays in headers; reconnect resumes the last fully validated event. */
export function watchProjectEvents(
  url: string,
  token: string,
  projectId: string,
  onEvent: (event: ProjectEvent) => void,
  onError: () => void,
): () => void {
  const lifetime = new AbortController();
  let after = "0";
  let activeReader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let reconnect: ReturnType<typeof setTimeout> | undefined;
  const connect = async () => {
    const connection = new AbortController();
    let idle: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const resetIdle = () => {
      if (idle) clearTimeout(idle);
      idle = setTimeout(() => connection.abort(), 15_000);
    };
    try {
      resetIdle();
      const response = await fetch(`${url}?after=${after}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "text/event-stream",
          "Last-Event-ID": after,
        },
        signal: AbortSignal.any([lifetime.signal, connection.signal]),
      });
      if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("text/event-stream") ||
        !response.body
      )
        throw new Error("Project stream unavailable");
      reader = response.body.getReader();
      activeReader = reader;
      const utf8 = new TextDecoder("utf-8", { fatal: true });
      const decoder = new ProjectEventDecoder(projectId, after);
      while (!lifetime.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) throw new Error("Project stream ended");
        resetIdle();
        if (lifetime.signal.aborted) break;
        for (const event of decoder.push(utf8.decode(value, { stream: true }))) {
          if (lifetime.signal.aborted) break;
          onEvent(event);
          after = event.sequence;
        }
      }
    } catch {
      if (!lifetime.signal.aborted) onError();
    } finally {
      if (activeReader === reader) activeReader = undefined;
      connection.abort();
      if (idle) clearTimeout(idle);
      await reader?.cancel().catch(() => undefined);
      if (!lifetime.signal.aborted) reconnect = setTimeout(() => void connect(), 2_000);
    }
  };
  void connect();
  return () => {
    lifetime.abort();
    void activeReader?.cancel().catch(() => undefined);
    if (reconnect) clearTimeout(reconnect);
  };
}
