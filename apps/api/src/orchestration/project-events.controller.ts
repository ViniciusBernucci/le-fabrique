import { type ProjectEventPage, projectEventCursorSchema } from "@le-fabrique/contracts";
import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Inject,
  type MessageEvent,
  Param,
  ParseUUIDPipe,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { ProjectEventsService } from "./project-events.service";

function cursor(value: unknown): string {
  const result = projectEventCursorSchema.safeParse(value ?? "0");
  if (!result.success) throw new BadRequestException("Invalid project event cursor");
  return result.data;
}

/** Sequential queries; disconnect cancels the timer and discards a pending result. */
export function projectEventStream(
  load: (after: string) => Promise<ProjectEventPage>,
  initial: string,
) {
  return new Observable<MessageEvent>((subscriber) => {
    let after = initial;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      try {
        const page = await load(after);
        if (stopped) return;
        for (const event of page.events)
          subscriber.next({ id: event.sequence, type: "project-change", data: event });
        after = page.nextCursor;
        if (page.events.length === 0)
          subscriber.next({ type: "heartbeat", data: { observedAt: new Date().toISOString() } });
        timer = setTimeout(() => void poll(), page.events.length === 100 ? 0 : 1_000);
      } catch {
        if (!stopped) subscriber.error(new Error("Project event stream unavailable"));
      }
    };
    void poll();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  });
}

@Controller("projects/:projectId/events")
@UseGuards(AdminAuthGuard)
export class ProjectEventsController {
  constructor(@Inject(ProjectEventsService) private readonly events: ProjectEventsService) {}

  @Get()
  async list(@Param("projectId", ParseUUIDPipe) projectId: string, @Query("after") after?: string) {
    return this.events.list(projectId, cursor(after));
  }

  @Sse("stream")
  stream(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Query("after") after?: string,
    @Headers("last-event-id") lastEventId?: string,
  ) {
    return projectEventStream(
      (next) => this.events.list(projectId, next),
      cursor(lastEventId ?? after),
    );
  }
}
