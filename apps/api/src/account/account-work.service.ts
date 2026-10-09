import type {
  ApproveRunDelivery,
  CreateTicket,
  PutProjectDefinition,
  RequestRunControl,
  RequestRunRecovery,
  RequestRunResume,
  UpdateProjectBaseRevision,
} from "@le-fabrique/contracts";
import {
  accountCreateProjectSchema,
  agentAssignmentSchema,
  factoryConfigurationSchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { ControlService } from "../control/control.service";
import { ExecutionArtifactsService } from "../orchestration/execution-artifacts.service";
import { ExecutionResultsService } from "../orchestration/execution-results.service";
import { ProjectEventsService } from "../orchestration/project-events.service";
import { RunControlService } from "../orchestration/run-control.service";
import { RunDeliveryService } from "../orchestration/run-delivery.service";
import { RunRecoveryService } from "../orchestration/run-recovery.service";
import { RunResumeService } from "../orchestration/run-resume.service";
import { PrismaService } from "../prisma.service";
import type { AccountPrincipal } from "./account.service";
import { type Access, accountProject, accountRole } from "./account-access";
import { quota } from "./account-billing.service";

import { scopedClient } from "./account-transaction";
@Injectable()
export class AccountWorkService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async projects(p: AccountPrincipal) {
    return this.prisma.$transaction(async (tx) => {
      const { org, m } = await accountRole(tx, p);
      const ids = ["OWNER", "ADMIN"].includes(m.role)
        ? undefined
        : (await tx.accountProjectGrant.findMany({ where: { membershipId: m.id } })).map(
            (g) => g.projectId,
          );
      return tx.project.findMany({
        where: { organizationId: org.id, ...(ids ? { id: { in: ids } } : {}) },
        orderBy: { createdAt: "desc" },
      });
    });
  }
  async create(p: AccountPrincipal, input: unknown) {
    const data = accountCreateProjectSchema.parse(input);
    return this.prisma.$transaction(async (tx) => {
      const { org, m } = await accountRole(tx, p);
      if (!["OWNER", "ADMIN"].includes(m.role))
        throw new ConflictException("Somente gestores criam projetos.");
      if (
        (await tx.project.count({ where: { organizationId: org.id } })) >=
        quota(org.planSnapshot).projects
      )
        throw new ConflictException("Limite de projetos atingido.");
      const project = await tx.project.create({ data: { ...data, organizationId: org.id } });
      await tx.accountAuditEvent.create({
        data: { organizationId: org.id, actorId: p.session.userId, action: "PROJECT_CREATED" },
      });
      return project;
    });
  }
  async project<T>(
    p: AccountPrincipal,
    id: string,
    access: Access,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    event?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await accountProject(tx, p, id, access);
        const result = await action(tx);
        if (event)
          await tx.accountAuditEvent.create({
            data: {
              organizationId: p.session.organizationId,
              actorId: p.session.userId,
              action: event,
            },
          });
        return result;
      },
      { timeout: 20000 },
    );
  }
  async run<T>(
    p: AccountPrincipal,
    id: string,
    access: Access,
    action: (tx: Prisma.TransactionClient) => Promise<T>,
    event?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const run = await tx.run.findUnique({ where: { id }, include: { ticket: true } });
        if (!run) throw new NotFoundException("Execução não disponível.");
        await accountProject(tx, p, run.ticket.projectId, access);
        const result = await action(tx);
        if (event)
          await tx.accountAuditEvent.create({
            data: {
              organizationId: p.session.organizationId,
              actorId: p.session.userId,
              action: event,
            },
          });
        return result;
      },
      { timeout: 20000 },
    );
  }
  definition(p: AccountPrincipal, id: string) {
    return this.project(p, id, "READ", (tx) =>
      new ControlService(scopedClient(tx)).getProjectDefinition(id),
    );
  }
  putDefinition(p: AccountPrincipal, id: string, input: PutProjectDefinition) {
    return this.project(
      p,
      id,
      "MANAGE",
      (tx) => new ControlService(scopedClient(tx)).putProjectDefinition(id, input),
      "PROJECT_DEFINITION_UPDATED",
    );
  }
  base(p: AccountPrincipal, id: string, input: UpdateProjectBaseRevision) {
    return this.project(
      p,
      id,
      "MANAGE",
      (tx) => new ControlService(scopedClient(tx)).updateProjectBaseRevision(id, input),
      "PROJECT_BASE_UPDATED",
    );
  }
  tickets(p: AccountPrincipal, id: string) {
    return this.project(p, id, "READ", (tx) =>
      new ControlService(scopedClient(tx)).listTickets(id),
    );
  }
  createTicket(p: AccountPrincipal, id: string, input: CreateTicket) {
    return this.project(
      p,
      id,
      "OPERATE",
      (tx) => new ControlService(scopedClient(tx)).createTicket(id, input),
      "TICKET_CREATED",
    );
  }
  async ready(p: AccountPrincipal, ticketId: string, version: number) {
    return this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({ where: { id: ticketId } });
      if (!ticket) throw new NotFoundException("Ticket não disponível.");
      await accountProject(tx, p, ticket.projectId, "OPERATE");
      await this.validateRoutes(tx, p.session.organizationId, ticket.projectId);
      await tx.accountJobAuthority.upsert({
        where: { ticketId },
        create: {
          ticketId,
          projectId: ticket.projectId,
          organizationId: p.session.organizationId,
          userId: p.session.userId,
        },
        update: { userId: p.session.userId, revoked: false },
      });
      await tx.accountAuditEvent.create({
        data: {
          organizationId: p.session.organizationId,
          actorId: p.session.userId,
          action: "TICKET_EXECUTION_REQUESTED",
        },
      });
      return new ControlService(scopedClient(tx)).markReady(ticketId, version);
    });
  }
  async validateRoutes(tx: Prisma.TransactionClient, org: string, projectId: string) {
    const github = await tx.accountIntegration.findMany({
      where: { organizationId: org, provider: "GITHUB", mode: "GITHUB_TOKEN", enabled: true },
    });
    const githubGrants = await tx.accountIntegrationGrant.count({
      where: { projectId, integrationId: { in: github.map((i) => i.id) } },
    });
    const project = await tx.project.findUniqueOrThrow({ where: { id: projectId } });
    if (new URL(project.repoUrl).hostname !== "github.com" || githubGrants !== 1)
      throw new ConflictException(
        "Autorize uma única integração GitHub privada para este projeto.",
      );
    const routes = await tx.accountProjectConfiguration.findUnique({ where: { projectId } });
    const config = routes ? factoryConfigurationSchema.safeParse(routes.configuration) : null;
    if (!config?.success)
      throw new ConflictException("Configure os agentes privados do projeto antes de executar.");
    for (const role of ["DEVELOPER", "REVIEWER"]) {
      const assignment = config.data.assignments.find((a) => a.role === role);
      if (!assignment?.enabled || !assignment.installationId)
        throw new ConflictException("Configure desenvolvedor e revisor.");
      for (const id of [
        assignment.installationId,
        ...(assignment.alternatives ?? []).map((a) => a.installationId),
      ]) {
        const integration = await tx.accountIntegration.findFirst({
          where: { organizationId: org, runtimeId: id, enabled: true, mode: "SUBSCRIPTION_CLI" },
        });
        if (
          !integration ||
          !(await tx.accountIntegrationGrant.findUnique({
            where: { integrationId_projectId: { integrationId: integration.id, projectId } },
          }))
        )
          throw new ConflictException("Integração sem autorização para este projeto.");
      }
    }
  }
  async grants(p: AccountPrincipal, id: string) {
    return this.project(p, id, "MANAGE", (tx) =>
      tx.accountProjectGrant.findMany({ where: { projectId: id } }),
    );
  }
  async grant(p: AccountPrincipal, id: string, membershipId: string, role: string | null) {
    return this.project(p, id, "MANAGE", async (tx) => {
      const m = await tx.accountMembership.findFirst({
        where: { id: membershipId, organizationId: p.session.organizationId, status: "ACTIVE" },
      });
      if (!m) throw new NotFoundException("Membro não disponível.");
      if (role)
        await tx.accountProjectGrant.upsert({
          where: { projectId_membershipId: { projectId: id, membershipId } },
          create: { projectId: id, membershipId, organizationId: p.session.organizationId, role },
          update: { role },
        });
      else await tx.accountProjectGrant.deleteMany({ where: { projectId: id, membershipId } });
      await tx.accountAuditEvent.create({
        data: {
          organizationId: p.session.organizationId,
          actorId: p.session.userId,
          action: "PROJECT_GRANT_CHANGED",
        },
      });
      return { saved: true };
    });
  }
  runs(p: AccountPrincipal, id: string) {
    return this.project(p, id, "READ", (tx) =>
      new ExecutionResultsService(scopedClient(tx)).list(id),
    );
  }
  detail(p: AccountPrincipal, id: string) {
    return this.run(p, id, "READ", (tx) =>
      new ExecutionResultsService(scopedClient(tx)).detail(id),
    );
  }
  delivery(p: AccountPrincipal, id: string) {
    return this.run(p, id, "READ", (tx) => new RunDeliveryService(scopedClient(tx)).get(id));
  }
  approve(p: AccountPrincipal, id: string, input: ApproveRunDelivery) {
    return this.run(
      p,
      id,
      "APPROVE",
      (tx) => new RunDeliveryService(scopedClient(tx)).approve(id, input),
      "RUN_DELIVERY_ACCEPTED",
    );
  }
  control(p: AccountPrincipal, id: string, input: RequestRunControl) {
    return this.run(
      p,
      id,
      "OPERATE",
      (tx) => new RunControlService(scopedClient(tx)).request(id, input),
      `RUN_${input.action}_REQUESTED`,
    );
  }
  resume(p: AccountPrincipal, id: string, input: RequestRunResume) {
    return this.run(p, id, "OPERATE", async (tx) => {
      const run = await tx.run.findUniqueOrThrow({ where: { id }, include: { ticket: true } });
      await this.validateRoutes(tx, p.session.organizationId, run.ticket.projectId);
      await tx.accountJobAuthority.upsert({
        where: { ticketId: run.ticketId },
        create: {
          ticketId: run.ticketId,
          projectId: run.ticket.projectId,
          organizationId: p.session.organizationId,
          userId: p.session.userId,
        },
        update: { userId: p.session.userId, revoked: false },
      });
      await tx.accountAuditEvent.create({
        data: {
          organizationId: p.session.organizationId,
          actorId: p.session.userId,
          action: "RUN_RESUME_REQUESTED",
        },
      });
      return new RunResumeService(scopedClient(tx)).request(id, input);
    });
  }
  recovery(p: AccountPrincipal, id: string, input: RequestRunRecovery) {
    return this.run(
      p,
      id,
      "MANAGE",
      (tx) => new RunRecoveryService(scopedClient(tx)).request(id, input),
      "RUN_RECOVERY_REQUESTED",
    );
  }
  artifact(p: AccountPrincipal, id: string, attemptId: string) {
    return this.run(p, id, "READ", (tx) =>
      new ExecutionArtifactsService(scopedClient(tx)).get(id, attemptId),
    );
  }
  events(p: AccountPrincipal, id: string, after: string) {
    return this.project(p, id, "READ", (tx) =>
      new ProjectEventsService(scopedClient(tx)).list(id, after),
    );
  }
  async routes(p: AccountPrincipal, id: string, input?: unknown) {
    return this.project(p, id, input === undefined ? "READ" : "MANAGE", async (tx) => {
      if (input === undefined)
        return tx.accountProjectConfiguration.findUnique({ where: { projectId: id } });
      const assignments = agentAssignmentSchema.array().max(6).parse(input);
      const { createDefaultFactoryConfiguration } = await import("../settings/settings.defaults");
      const defaults = createDefaultFactoryConfiguration();
      const integrations = await tx.accountIntegration.findMany({
        where: {
          organizationId: p.session.organizationId,
          enabled: true,
          mode: "SUBSCRIPTION_CLI",
        },
      });
      const settings = await tx.factorySettings.findUnique({ where: { id: "global" } });
      const global = settings ? factoryConfigurationSchema.parse(settings.configuration) : defaults;
      const allowed = new Set(
        (await tx.accountIntegrationGrant.findMany({ where: { projectId: id } })).map(
          (g) => g.integrationId,
        ),
      );
      const runtimeIds = new Set(
        integrations.filter((i) => allowed.has(i.id)).map((i) => i.runtimeId),
      );
      const config = factoryConfigurationSchema.parse({
        ...defaults,
        installations: global.installations.filter((i) => runtimeIds.has(i.id)),
        assignments,
      });
      await tx.accountAuditEvent.create({
        data: {
          organizationId: p.session.organizationId,
          actorId: p.session.userId,
          action: "PROJECT_AGENTS_UPDATED",
        },
      });
      return tx.accountProjectConfiguration.upsert({
        where: { projectId: id },
        create: { projectId: id, organizationId: p.session.organizationId, configuration: config },
        update: { configuration: config, version: { increment: 1 } },
      });
    });
  }
}
