import type { WorkerIdentity, WorkerRegistration } from "@le-fabrique/contracts";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { WorkerIdentity as WorkerRecord } from "@prisma/client";
import { PrismaService } from "../prisma.service";

function mapWorker(worker: WorkerRecord): WorkerIdentity {
  return {
    id: worker.id,
    name: worker.name,
    status: worker.status,
    capabilities: worker.capabilities as string[],
    os: worker.os,
    arch: worker.arch,
    nodeVersion: worker.nodeVersion,
    lastHeartbeatAt: worker.lastHeartbeatAt.toISOString(),
    createdAt: worker.createdAt.toISOString(),
    updatedAt: worker.updatedAt.toISOString(),
  };
}

@Injectable()
export class WorkerIdentityService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async register(input: WorkerRegistration): Promise<WorkerIdentity> {
    const now = new Date();
    return mapWorker(
      await this.prisma.workerIdentity.upsert({
        where: { id: input.id },
        create: {
          ...input,
          capabilities: input.capabilities,
          status: "ONLINE",
          lastHeartbeatAt: now,
        },
        update: {
          ...input,
          capabilities: input.capabilities,
          status: "ONLINE",
          lastHeartbeatAt: now,
        },
      }),
    );
  }

  async heartbeat(workerId: string): Promise<{ workerId: string; acceptedAt: string }> {
    const acceptedAt = new Date();
    const updated = await this.prisma.workerIdentity.updateMany({
      where: { id: workerId },
      data: { status: "ONLINE", lastHeartbeatAt: acceptedAt },
    });
    if (updated.count !== 1) throw new NotFoundException("Worker not registered");
    return { workerId, acceptedAt: acceptedAt.toISOString() };
  }

  async list(): Promise<WorkerIdentity[]> {
    return (await this.prisma.workerIdentity.findMany({ orderBy: { createdAt: "asc" } })).map(
      mapWorker,
    );
  }
}
