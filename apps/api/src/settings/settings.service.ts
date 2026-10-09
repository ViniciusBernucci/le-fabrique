import {
  type FactoryConfiguration,
  type FactorySettings,
  factoryConfigurationSchema,
  type UpdateFactorySettings,
  type WorkerConfigurationSnapshot,
  workerConfigurationSnapshotSchema,
} from "@le-fabrique/contracts";
import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import type { FactorySettings as FactorySettingsRecord, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { encryptProviderApiKey } from "./api-key-encryption";
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
    if (installation.authMode !== existing.authMode)
      throw new BadRequestException("Create another installation to change authentication mode");
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

  async getWorkerConfigurationSnapshot(now = new Date()): Promise<WorkerConfigurationSnapshot> {
    const settings = await this.prisma.factorySettings.findUnique({ where: { id: SETTINGS_ID } });
    return workerConfigurationSnapshotSchema.parse({
      version: settings?.version ?? 0,
      observedAt: now.toISOString(),
      configuration: settings
        ? factoryConfigurationSchema.parse(settings.configuration)
        : createDefaultFactoryConfiguration(),
    });
  }

  async update(
    expectedVersion: number,
    configuration: FactoryConfiguration,
    apiKeys: UpdateFactorySettings["apiKeys"] = [],
  ): Promise<FactorySettings> {
    configuration = factoryConfigurationSchema.parse(configuration);
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.factorySettings.findUnique({ where: { id: SETTINGS_ID } });
      if (!current || current.version !== expectedVersion) {
        throw new ConflictException("Settings changed; reload before saving");
      }
      const projectIds = [
        ...new Set([
          ...(configuration.projectSkills ?? []).map((skill) => skill.projectId),
          ...(configuration.digitalAgents ?? []).flatMap((agent) =>
            agent.projectId ? [agent.projectId] : [],
          ),
        ]),
      ];
      if (projectIds.length > 0) {
        const projects = await transaction.project.findMany({
          where: { id: { in: projectIds } },
          select: { id: true },
        });
        if (new Set(projects.map((project) => project.id)).size !== projectIds.length)
          throw new BadRequestException("Agent or skill project does not exist");
      }
      assertObservedStatesUnchanged(
        factoryConfigurationSchema.parse(current.configuration),
        configuration,
      );
      const previous = factoryConfigurationSchema.parse(current.configuration);
      const keys = new Map(apiKeys.map((entry) => [entry.installationId, entry.key]));
      if (keys.size !== apiKeys.length)
        throw new BadRequestException("Duplicate API key installations");
      for (const id of keys.keys()) {
        if (
          !configuration.installations.some((item) => item.id === id && item.authMode === "API_KEY")
        )
          throw new BadRequestException("API key requires a registered API installation");
      }
      for (const installation of configuration.installations) {
        if (installation.authMode !== "API_KEY") continue;
        const old = previous.installations.find((item) => item.id === installation.id);
        if (
          (old?.authMode !== "API_KEY" || old.provider !== installation.provider) &&
          !keys.has(installation.id)
        )
          throw new BadRequestException("API registration requires a key");
        const key = keys.get(installation.id);
        if (key) {
          const encryptedKey = encryptProviderApiKey(installation.id, installation.provider, key);
          await transaction.providerApiCredential.upsert({
            where: { installationId: installation.id },
            create: {
              installationId: installation.id,
              provider: installation.provider,
              encryptedKey,
            },
            update: { provider: installation.provider, encryptedKey },
          });
        }
      }
      if (previous.installations.some((item) => item.authMode === "API_KEY"))
        await transaction.providerApiCredential.deleteMany({
          where: {
            installationId: {
              notIn: configuration.installations
                .filter((item) => item.authMode === "API_KEY")
                .map((item) => item.id),
            },
          },
        });
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
