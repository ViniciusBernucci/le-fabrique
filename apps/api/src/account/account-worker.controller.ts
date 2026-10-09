import {
  Body,
  ConflictException,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { PrismaService } from "../prisma.service";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { jobAuthorized } from "./account-access";
import { AccountExceptionFilter } from "./account-exception.filter";
import { decryptPrivate } from "./account-private";

const request = z
  .object({ workerId: z.uuid(), fencingToken: z.number().int().positive() })
  .strict();
/** Private supervisor channel. Credentials never enter the job, model, artifact or account UI. */
@Controller("internal/account-repositories")
@UseGuards(WorkerAuthGuard)
@UseFilters(AccountExceptionFilter)
export class AccountWorkerController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  @Post(":attemptId/credential") credential(
    @Param("attemptId", ParseUUIDPipe) attemptId: string,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: { setHeader(n: string, v: string): void },
  ) {
    response.setHeader("Cache-Control", "no-store");
    const input = request.parse(body);
    return this.prisma.$transaction(async (tx) => {
      const attempt = await tx.attempt.findUnique({
        where: { id: attemptId },
        include: { run: { include: { ticket: { include: { project: true } } } } },
      });
      if (
        !attempt ||
        attempt.workerId !== input.workerId ||
        attempt.fencingToken !== input.fencingToken ||
        attempt.run.nextFencingToken !== input.fencingToken ||
        attempt.status !== "RUNNING" ||
        attempt.leaseExpiresAt <= new Date() ||
        attempt.stoppedConfirmed
      )
        throw new ConflictException("Current worker lease required");
      const project = attempt.run.ticket.project;
      if (!project.organizationId) return { scoped: false, token: null };
      if (!(await jobAuthorized(tx, attempt.run.ticketId, project.organizationId)))
        throw new ConflictException("Account authority revoked");
      const grants = await tx.accountIntegrationGrant.findMany({
        where: { projectId: project.id, organizationId: project.organizationId },
      });
      const integrations = await tx.accountIntegration.findMany({
        where: {
          id: { in: grants.map((g) => g.integrationId) },
          organizationId: project.organizationId,
          provider: "GITHUB",
          mode: "GITHUB_TOKEN",
          enabled: true,
        },
      });
      if (
        integrations.length !== 1 ||
        !integrations[0]?.secretEncrypted ||
        new URL(project.repoUrl).hostname !== "github.com"
      )
        throw new ConflictException(
          "One private GitHub credential must be authorized for this project",
        );
      const i = integrations[0];
      return {
        scoped: true,
        token: decryptPrivate(i.secretEncrypted ?? "", `integration:${i.id}`),
      };
    });
  }
}
