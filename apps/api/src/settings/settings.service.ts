import {
  type FactoryConfiguration,
  type FactorySettings,
  factoryConfigurationSchema,
} from "@le-fabrique/contracts";
import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
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

function assertObservedStatesUnchanged(
  current: FactoryConfiguration,
  requested: FactoryConfiguration,
): void {
  const currentInstallations = new Map(current.installations.map((item) => [item.id, item]));
  for (const installation of requested.installations) {
    const existing = currentInstallations.get(installation.id);
    if (!existing) {
      if (installation.state !== "AUTH_REQUIRED") {
        throw new BadRequestException("New provider installations must require authentication");
      }
      continue;
    }
    if (installation.state !== existing.state) {
      throw new BadRequestException("Provider state is managed by worker evidence");
    }
    if (
      existing.state !== "AUTH_REQUIRED" &&
      (installation.provider !== existing.provider ||
        installation.executable !== existing.executable ||
        installation.authMode !== existing.authMode)
    ) {
      throw new BadRequestException("Reconfigure provider identity through worker onboarding");
    }
  }
  if (requested.github.state !== current.github.state) {
    throw new BadRequestException("GitHub state is managed by worker evidence");
  }
}

@Injectable()
export class SettingsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(): Promise<FactorySettings> {
    const configuration = createDefaultFactoryConfiguration();
    return mapSettings(
      await this.prisma.factorySettings.upsert({
        where: { id: SETTINGS_ID },
        create: {
          id: SETTINGS_ID,
          configuration: configuration as Prisma.InputJsonValue,
        },
        update: {},
      }),
    );
  }

  async update(
    expectedVersion: number,
    configuration: FactoryConfiguration,
  ): Promise<FactorySettings> {
    factoryConfigurationSchema.parse(configuration);
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.factorySettings.findUnique({ where: { id: SETTINGS_ID } });
      if (!current || current.version !== expectedVersion) {
        throw new ConflictException("Settings changed; reload before saving");
      }
      assertObservedStatesUnchanged(
        factoryConfigurationSchema.parse(current.configuration),
        configuration,
      );
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
