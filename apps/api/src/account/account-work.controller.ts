import {
  accountCreateProjectSchema,
  accountGrantSchema,
  approveRunDeliverySchema,
  createTicketSchema,
  projectEventCursorSchema,
  putProjectDefinitionSchema,
  requestRunControlSchema,
  requestRunRecoverySchema,
  requestRunResumeSchema,
  updateProjectBaseRevisionSchema,
} from "@le-fabrique/contracts";
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Sse,
  UseFilters,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { projectEventStream } from "../orchestration/project-events.controller";
import { AccountGuard, type AccountRequest } from "./account.guard";
import { AccountExceptionFilter } from "./account-exception.filter";
import { AccountWorkService } from "./account-work.service";

const p = (r: AccountRequest) => {
  if (!r.principal) throw new Error("AccountGuard required");
  return r.principal;
};
const parse = <T extends z.ZodType>(s: T, b: unknown): z.infer<T> => {
  const v = s.safeParse(b);
  if (!v.success) throw new BadRequestException("Revise os campos informados.");
  return v.data;
};
@Controller("account/work")
@UseGuards(AccountGuard)
@UseFilters(AccountExceptionFilter)
export class AccountWorkController {
  constructor(@Inject(AccountWorkService) private readonly work: AccountWorkService) {}
  @Get("projects") projects(@Req() r: AccountRequest) {
    return this.work.projects(p(r));
  }
  @Post("projects") create(@Req() r: AccountRequest, @Body() b: unknown) {
    return this.work.create(p(r), parse(accountCreateProjectSchema, b));
  }
  @Get("projects/:id/definition") definition(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.work.definition(p(r), id);
  }
  @Put("projects/:id/definition") putDefinition(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.putDefinition(p(r), id, parse(putProjectDefinitionSchema, b));
  }
  @Patch("projects/:id/base-revision") base(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.base(p(r), id, parse(updateProjectBaseRevisionSchema, b));
  }
  @Get("projects/:id/tickets") tickets(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.work.tickets(p(r), id);
  }
  @Post("projects/:id/tickets") createTicket(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.createTicket(p(r), id, parse(createTicketSchema, b));
  }
  @Post("tickets/:id/ready") ready(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.ready(
      p(r),
      id,
      parse(z.object({ expectedVersion: z.number().int().positive() }).strict(), b).expectedVersion,
    );
  }
  @Get("projects/:id/grants") grants(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.work.grants(p(r), id);
  }
  @Put("projects/:id/grants") grant(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    const v = parse(accountGrantSchema, b);
    return this.work.grant(p(r), id, v.membershipId, v.role);
  }
  @Delete("projects/:id/grants/:member") revoke(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("member", ParseUUIDPipe) m: string,
  ) {
    return this.work.grant(p(r), id, m, null);
  }
  @Get("projects/:id/routes") routes(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.work.routes(p(r), id);
  }
  @Put("projects/:id/routes") putRoutes(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.routes(p(r), id, b);
  }
  @Get("projects/:id/runs") runs(@Req() r: AccountRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.work.runs(p(r), id);
  }
  @Get("runs/:id") detail(@Req() r: AccountRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.work.detail(p(r), id);
  }
  @Get("runs/:id/delivery") delivery(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.work.delivery(p(r), id);
  }
  @Post("runs/:id/approval") approve(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.approve(p(r), id, parse(approveRunDeliverySchema, b));
  }
  @Post("runs/:id/control") control(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.control(p(r), id, parse(requestRunControlSchema, b));
  }
  @Post("runs/:id/resume") resume(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.resume(p(r), id, parse(requestRunResumeSchema, b));
  }
  @Post("runs/:id/recovery") recovery(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() b: unknown,
  ) {
    return this.work.recovery(p(r), id, parse(requestRunRecoverySchema, b));
  }
  @Get("runs/:id/attempts/:attempt/artifact") artifact(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attempt", ParseUUIDPipe) a: string,
  ) {
    return this.work.artifact(p(r), id, a);
  }
  @Get("projects/:id/events") events(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("after") after?: string,
  ) {
    return this.work.events(p(r), id, parse(projectEventCursorSchema, after ?? "0"));
  }
  @Sse("projects/:id/events/stream") stream(
    @Req() r: AccountRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("after") after?: string,
  ) {
    return projectEventStream(
      (cursor) => this.work.events(p(r), id, cursor),
      parse(projectEventCursorSchema, after ?? "0"),
    );
  }
}
