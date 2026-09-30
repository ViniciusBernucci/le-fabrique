import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  constructor() {
    super(process.env.REDIS_URL ?? "redis://127.0.0.1:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.status === "wait") {
      await this.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.status !== "end") {
      await this.quit();
    }
  }
}
