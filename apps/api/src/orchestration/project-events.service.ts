import { projectEventPageSchema } from "@le-fabrique/contracts";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class ProjectEventsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(projectId: string, after: string) {
    if (!(await this.prisma.project.findUnique({ where: { id: projectId }, select: { id: true } })))
      throw new NotFoundException("Project not found");
    const events = await this.prisma.projectEvent.findMany({
      where: { projectId, sequence: { gt: BigInt(after) } },
      orderBy: { sequence: "asc" },
      take: 100,
      select: { projectId: true, sequence: true, kind: true, entityId: true, createdAt: true },
    });
    return projectEventPageSchema.parse({
      projectId,
      after,
      nextCursor: events.at(-1)?.sequence.toString() ?? after,
      events: events.map((event) => ({
        ...event,
        sequence: event.sequence.toString(),
        createdAt: event.createdAt.toISOString(),
      })),
    });
  }
}
