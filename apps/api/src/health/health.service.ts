import type { HealthResponse, HealthStatus, ReadinessResponse } from "@le-fabrique/contracts";
import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { RedisService } from "../redis.service";

@Injectable()
export class HealthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(RedisService) private readonly redis: RedisService,
  ) {}

  liveness(): HealthResponse {
    return { status: "ok", service: "api", timestamp: new Date().toISOString() };
  }

  async readiness(): Promise<ReadinessResponse> {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    return {
      status: database === "ok" && redis === "ok" ? "ok" : "error",
      service: "api",
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };
  }

  private async checkDatabase(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return "ok";
    } catch {
      return "error";
    }
  }

  private async checkRedis(): Promise<HealthStatus> {
    try {
      await this.redis.ensureConnected();
      return (await this.redis.ping()) === "PONG" ? "ok" : "error";
    } catch {
      return "error";
    }
  }
}
