import { updateFactorySchedulingSchema } from "@le-fabrique/contracts";
import { BadRequestException, Body, Controller, Inject, Put, UseGuards } from "@nestjs/common";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { FactorySchedulingService } from "./factory-scheduling.service";

@Controller("operation/scheduling")
@UseGuards(AdminAuthGuard)
export class FactorySchedulingController {
  constructor(
    @Inject(FactorySchedulingService) private readonly scheduling: FactorySchedulingService,
  ) {}
  @Put()
  async update(@Body() body: unknown) {
    const input = updateFactorySchedulingSchema.safeParse(body);
    if (!input.success) throw new BadRequestException("Invalid factory scheduling request");
    return this.scheduling.update(input.data);
  }
}
