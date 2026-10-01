import {
  type FactoryConfiguration,
  type FactorySettings,
  factoryConfigurationSchema,
} from "@le-fabrique/contracts";
import { ConflictException, Inject, Injectable } from "@nestjs/common";
import type { FactorySettings as FactorySettingsRecord, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { createDefaultFactoryConfiguration } from "./settings.defaults";

const SETTINGS_ID = "global";

function mapSettings(settings: FactorySettingsRecord): FactorySettings {
  return {
    version: settings.version,
    configuration: factoryConfigurationSchema.parse(settings.configuration),
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(): Promise<FactorySettings> {
    const existing = await this.prisma.factorySettings.findUnique({ where: { id: SETTINGS_ID } });
    if (existing) return mapSettings(existing);
    const configuration = createDefaultFactoryConfiguration();
    return mapSettings(
      await this.prisma.factorySettings.create({
        data: {
          id: SETTINGS_ID,
          configuration: configuration as Prisma.InputJsonValue,
        },
      }),
    );
  }

  async update(
    expectedVersion: number,
    configuration: FactoryConfiguration,
  ): Promise<FactorySettings> {
    factoryConfigurationSchema.parse(configuration);
    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.factorySettings.updateMany({
        where: { id: SETTINGS_ID, version: expectedVersion },
        data: {
          configuration: configuration as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new ConflictException("Settings changed; reload before saving");
      }
      return mapSettings(
        await transaction.factorySettings.findUniqueOrThrow({ where: { id: SETTINGS_ID } }),
      );
    });
  }
}
