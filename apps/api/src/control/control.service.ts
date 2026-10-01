import type { CreateProject, CreateTicket, Project, Ticket } from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, Ticket as TicketRecord } from "@prisma/client";
import { PrismaService } from "../prisma.service";

function mapProject(project: {
  id: string;
  name: string;
  repoUrl: string;
  baseRef: string;
  createdAt: Date;
  updatedAt: Date;
}): Project {
  return {
    ...project,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function mapTicket(ticket: TicketRecord): Ticket {
  return {
    id: ticket.id,
    projectId: ticket.projectId,
    title: ticket.title,
    objective: ticket.objective,
    acceptanceCriteria: ticket.acceptanceCriteria as string[],
    status: ticket.status,
    version: ticket.version,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

@Injectable()
export class ControlService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createProject(input: CreateProject): Promise<Project> {
    return mapProject(await this.prisma.project.create({ data: input }));
  }

  async listProjects(): Promise<Project[]> {
    return (await this.prisma.project.findMany({ orderBy: { createdAt: "desc" } })).map(mapProject);
  }

  async createTicket(projectId: string, input: CreateTicket): Promise<Ticket> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    return mapTicket(
      await this.prisma.ticket.create({
        data: { ...input, acceptanceCriteria: input.acceptanceCriteria, projectId },
      }),
    );
  }

  async listTickets(projectId: string): Promise<Ticket[]> {
    return (
      await this.prisma.ticket.findMany({ where: { projectId }, orderBy: { createdAt: "desc" } })
    ).map(mapTicket);
  }

  async markReady(ticketId: string, expectedVersion: number): Promise<Ticket> {
    return this.prisma.$transaction(async (transaction) => {
      const ticket = await transaction.ticket.findUnique({
        where: { id: ticketId },
        include: { project: { select: { baseRef: true } } },
      });
      if (!ticket) throw new NotFoundException("Ticket not found");
      const deduplicationKey = `ticket:${ticketId}:ready`;
      if (ticket.status === "READY") {
        const event = await transaction.outboxEvent.findUnique({ where: { deduplicationKey } });
        if (event) return mapTicket(ticket);
      }
      if (ticket.status !== "DRAFT" || ticket.version !== expectedVersion) {
        throw new ConflictException("Ticket state or version changed");
      }
      const updated = await transaction.ticket.updateMany({
        where: { id: ticketId, status: "DRAFT", version: expectedVersion },
        data: { status: "READY", version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException("Ticket was updated concurrently");
      const readyTicket = await transaction.ticket.findUniqueOrThrow({ where: { id: ticketId } });
      await transaction.outboxEvent.create({
        data: {
          aggregateId: ticketId,
          eventType: "ticket.ready.v1",
          deduplicationKey,
          payload: {
            ticketId,
            projectId: ticket.projectId,
            ticketVersion: readyTicket.version,
            baseRevision: /^[0-9a-f]{40}$/.test(ticket.project.baseRef)
              ? ticket.project.baseRef
              : null,
          } satisfies Prisma.InputJsonValue,
        },
      });
      return mapTicket(readyTicket);
    });
  }
}
