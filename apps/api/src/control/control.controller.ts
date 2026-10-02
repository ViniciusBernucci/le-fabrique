import {
  adminSessionSchema,
  createProjectSchema,
  createTicketSchema,
  projectListSchema,
  projectSchema,
  readyTicketSchema,
  ticketListSchema,
  ticketSchema,
  updateProjectBaseRevisionSchema,
} from "@le-fabrique/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { z } from "zod";
import { AdminAuthGuard } from "./admin-auth.guard";
import { ControlService } from "./control.service";

function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw new BadRequestException("Invalid request payload");
  return result.data;
}

@Controller()
@UseGuards(AdminAuthGuard)
export class ControlController {
  constructor(@Inject(ControlService) private readonly control: ControlService) {}

  @Get("auth/session")
  session() {
    return adminSessionSchema.parse({ authenticated: true });
  }

  @Post("projects")
  async createProject(@Body() body: unknown) {
    return projectSchema.parse(await this.control.createProject(parse(createProjectSchema, body)));
  }

  @Get("projects")
  async listProjects() {
    return projectListSchema.parse(await this.control.listProjects());
  }

  @Patch("projects/:projectId/base-revision")
  async updateProjectBaseRevision(
    @Param("projectId", ParseUUIDPipe) projectId: string,
    @Body() body: unknown,
  ) {
    return projectSchema.parse(
      await this.control.updateProjectBaseRevision(
        projectId,
        parse(updateProjectBaseRevisionSchema, body),
      ),
    );
  }

  @Post("projects/:projectId/tickets")
  async createTicket(@Param("projectId", ParseUUIDPipe) projectId: string, @Body() body: unknown) {
    return ticketSchema.parse(
      await this.control.createTicket(projectId, parse(createTicketSchema, body)),
    );
  }

  @Get("projects/:projectId/tickets")
  async listTickets(@Param("projectId", ParseUUIDPipe) projectId: string) {
    return ticketListSchema.parse(await this.control.listTickets(projectId));
  }

  @Post("tickets/:ticketId/ready")
  async markReady(@Param("ticketId", ParseUUIDPipe) ticketId: string, @Body() body: unknown) {
    const input = parse(readyTicketSchema, body);
    return ticketSchema.parse(await this.control.markReady(ticketId, input.expectedVersion));
  }
}
