import type { HealthResponse, ReadinessResponse } from "@le-fabrique/contracts";
import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { HealthService } from "./health.service";

@Controller("health")
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get("live")
  live(): HealthResponse {
    return this.healthService.liveness();
  }

  @Get("ready")
  async ready(): Promise<ReadinessResponse> {
    const response = await this.healthService.readiness();
    if (response.status === "error") {
      throw new ServiceUnavailableException(response);
    }
    return response;
  }
}
