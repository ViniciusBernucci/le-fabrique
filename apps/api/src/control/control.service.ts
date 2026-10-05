import {
  type CreateProject,
  type CreateTicket,
  executionSpecificationSchema,
  gitCommitShaSchema,
  type Project,
  type ProjectDefinition,
  type ProjectDefinitionState,
  type PutProjectDefinition,
  projectDefinitionInputSchema,
  type Ticket,
  type UpdateProjectBaseRevision,
} from "@le-fabrique/contracts";
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

function mapProjectDefinition(definition: {
  projectId: string;
  version: number;
  configuration: unknown;
  createdAt: Date;
  updatedAt: Date;
}): ProjectDefinition {
  return {
    projectId: definition.projectId,
    version: definition.version,
    ...projectDefinitionInputSchema.parse(definition.configuration),
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
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

  async getProjectDefinition(projectId: string): Promise<ProjectDefinitionState> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { definition: true },
    });
    if (!project) throw new NotFoundException("Project not found");
    return { definition: project.definition ? mapProjectDefinition(project.definition) : null };
  }

  async putProjectDefinition(
    projectId: string,
    input: PutProjectDefinition,
  ): Promise<ProjectDefinition> {
    return this.prisma.$transaction(async (transaction) => {
      const project = await transaction.project.findUnique({
        where: { id: projectId },
        include: { definition: true },
      });
      if (!project) throw new NotFoundException("Project not found");
      if (!project.definition) {
        if (input.expectedVersion !== 0) {
          throw new ConflictException("Project definition version changed");
        }
        return mapProjectDefinition(
          await transaction.projectDefinition.create({
            data: { projectId, configuration: input.definition as Prisma.InputJsonValue },
          }),
        );
      }
      if (project.definition.version !== input.expectedVersion) {
        throw new ConflictException("Project definition version changed");
      }
      const updated = await transaction.projectDefinition.updateMany({
        where: { projectId, version: input.expectedVersion },
        data: {
          configuration: input.definition as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1)
        throw new ConflictException("Project definition was updated concurrently");
      return mapProjectDefinition(
        await transaction.projectDefinition.findUniqueOrThrow({ where: { projectId } }),
      );
    });
  }

  async updateProjectBaseRevision(
    projectId: string,
    input: UpdateProjectBaseRevision,
  ): Promise<Project> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.project.findUnique({ where: { id: projectId } });
      if (!current) throw new NotFoundException("Project not found");
      if (current.baseRef !== input.expectedBaseRef) {
        throw new ConflictException("Project base reference changed");
      }
      const updated = await transaction.project.updateMany({
        where: { id: projectId, baseRef: input.expectedBaseRef },
        data: { baseRef: input.baseRevision },
      });
      if (updated.count !== 1) throw new ConflictException("Project was updated concurrently");
      return mapProject(await transaction.project.findUniqueOrThrow({ where: { id: projectId } }));
    });
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
        include: {
          project: {
            select: {
              name: true,
              repoUrl: true,
              baseRef: true,
              definition: { select: { version: true, configuration: true } },
            },
          },
        },
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
      const baseRevision = gitCommitShaSchema.safeParse(ticket.project.baseRef);
      if (!baseRevision.success) {
        throw new ConflictException(
          "Project base revision must be an exact lowercase 40-character commit SHA",
        );
      }
      if (!ticket.project.definition) {
        throw new ConflictException("Project definition must be configured before READY");
      }
      const definition = projectDefinitionInputSchema.parse(
        ticket.project.definition.configuration,
      );
      if (!definition.executionProfile) {
        throw new ConflictException(
          "Project execution profile with approved context and checks is required before READY",
        );
      }
      if (!definition.executionProfile.documentation) {
        throw new ConflictException("Project documentation policy is required before READY");
      }
      const executionSpecification = executionSpecificationSchema.parse({
        schemaVersion: 1,
        project: {
          id: ticket.projectId,
          name: ticket.project.name,
          repoUrl: ticket.project.repoUrl,
          baseRevision: baseRevision.data,
          definitionVersion: ticket.project.definition.version,
          definition,
        },
        ticket: {
          id: ticket.id,
          version: ticket.version + 1,
          title: ticket.title,
          objective: ticket.objective,
          acceptanceCriteria: ticket.acceptanceCriteria,
        },
      });
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
            baseRevision: baseRevision.data,
            projectDefinitionVersion: ticket.project.definition.version,
            executionSpecification,
          } satisfies Prisma.InputJsonValue,
        },
      });
      return mapTicket(readyTicket);
    });
  }
}
