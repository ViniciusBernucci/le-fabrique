import { factorySchedulingStateSchema, type UpdateFactoryScheduling } from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";

@Injectable()
export class FactorySchedulingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async update(input: UpdateFactoryScheduling) {
    return this.prisma.$transaction(
      async (transaction) => {
        const changed = await transaction.factoryOperation.updateMany({
          where: { id: "factory", version: input.expectedVersion },
          data: { paused: input.paused, version: { increment: 1 } },
        });
        if (changed.count !== 1)
          throw new ConflictException("Factory scheduling changed or is uninitialized");
        const state = await transaction.factoryOperation.findUniqueOrThrow({
          where: { id: "factory" },
        });
        return factorySchedulingStateSchema.parse({
          paused: state.paused,
          version: state.version,
          updatedAt: state.updatedAt.toISOString(),
        });
      },
      { isolationLevel: "Serializable" },
    );
  }
}
