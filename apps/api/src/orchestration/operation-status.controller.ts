import { Controller, Get, Inject, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { OperationStatusService } from "./operation-status.service";

@Controller("operation")
@UseGuards(AdminAuthGuard)
export class OperationStatusController {
  constructor(@Inject(OperationStatusService) private readonly operation: OperationStatusService) {}

  @Get()
  async read() {
    return this.operation.read();
  }
}
