import {
  type CompleteProviderVerification,
  type FactoryConfiguration,
  factoryConfigurationSchema,
  type ProviderVerification,
  providerVerificationSchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, ProviderVerification as VerificationRecord } from "@prisma/client";
import { PrismaService } from "../prisma.service";

function mapVerification(record: VerificationRecord): ProviderVerification {
  return providerVerificationSchema.parse({
    ...record,
    observedModels: record.observedModels,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    completedAt: record.completedAt?.toISOString() ?? null,
  });
}

@Injectable()
export class ProviderVerificationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async request(installationId: string): Promise<ProviderVerification> {
    return this.prisma.$transaction(
      async (transaction) => {
        const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
        if (!settings) throw new NotFoundException("Factory settings not initialized");
        const configuration = factoryConfigurationSchema.parse(settings.configuration);
        const installation = configuration.installations.find((item) => item.id === installationId);
        if (!installation) throw new NotFoundException("Provider installation not found");
        const active = await transaction.providerVerification.findFirst({
          where: { installationId, status: { in: ["PENDING", "RUNNING"] } },
          orderBy: { createdAt: "desc" },
        });
        if (active) return mapVerification(active);
        const verification = await transaction.providerVerification.create({
          data: { installationId, provider: installation.provider },
        });
        await transaction.outboxEvent.create({
          data: {
            aggregateId: verification.id,
            eventType: "provider.verification.requested.v1",
            deduplicationKey: `provider-verification:${verification.id}:requested`,
            payload: {
              verificationId: verification.id,
              installationId,
              provider: installation.provider,
            } satisfies Prisma.InputJsonValue,
          },
        });
        return mapVerification(verification);
      },
      { isolationLevel: "Serializable" },
    );
  }

  async list(): Promise<ProviderVerification[]> {
    return (
      await this.prisma.providerVerification.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ).map(mapVerification);
  }

  async start(id: string, workerId: string): Promise<ProviderVerification> {
    const current = await this.prisma.providerVerification.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Provider verification not found");
    if (current.status === "RUNNING" && current.workerId === workerId)
      return mapVerification(current);
    if (current.status !== "PENDING") throw new ConflictException("Verification is not pending");
    return mapVerification(
      await this.prisma.providerVerification.update({
        where: { id },
        data: { status: "RUNNING", workerId, startedAt: new Date() },
      }),
    );
  }

  async complete(id: string, input: CompleteProviderVerification): Promise<ProviderVerification> {
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.providerVerification.findUnique({ where: { id } });
      if (!current) throw new NotFoundException("Provider verification not found");
      if (["COMPLETED", "FAILED"].includes(current.status)) {
        const same =
          current.workerId === input.workerId &&
          current.status === input.status &&
          current.providerState === input.providerState &&
          current.cliVersion === input.cliVersion &&
          JSON.stringify(current.observedModels) === JSON.stringify(input.observedModels) &&
          current.message === input.message;
        if (!same) throw new ConflictException("Verification already has another result");
        return mapVerification(current);
      }
      if (current.status !== "RUNNING" || current.workerId !== input.workerId) {
        throw new ConflictException("Verification belongs to another worker or state");
      }
      const settings = await transaction.factorySettings.findUnique({ where: { id: "global" } });
      if (!settings) throw new NotFoundException("Factory settings not initialized");
      const configuration = factoryConfigurationSchema.parse(settings.configuration);
      const installationIndex = configuration.installations.findIndex(
        (item) => item.id === current.installationId,
      );
      const installation = configuration.installations[installationIndex];
      if (!installation || installation.provider !== current.provider) {
        throw new ConflictException("Provider installation changed during verification");
      }
      const updatedConfiguration: FactoryConfiguration = {
        ...configuration,
        installations: configuration.installations.map((item, index) =>
          index === installationIndex ? { ...item, state: input.providerState } : item,
        ),
      };
      await transaction.factorySettings.update({
        where: { id: "global" },
        data: {
          configuration: updatedConfiguration as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      return mapVerification(
        await transaction.providerVerification.update({
          where: { id },
          data: {
            status: input.status,
            providerState: input.providerState,
            cliVersion: input.cliVersion,
            observedModels: input.observedModels,
            message: input.message,
            completedAt: new Date(),
          },
        }),
      );
    });
  }
}
