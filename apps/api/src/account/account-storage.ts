import { ARTIFACT_JSON_MAX_BYTES } from "@le-fabrique/contracts";
import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { quota } from "./account-billing.service";
export async function storedBytes(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<number> {
  return Number(
    (
      await tx.$queryRaw<
        { bytes: bigint }[]
      >`SELECT COALESCE(sum(octet_length(a.artifact::text)),0)::bigint AS bytes FROM attempts a JOIN runs r ON r.id=a.run_id JOIN tickets t ON t.id=r.ticket_id JOIN projects p ON p.id=t.project_id WHERE p.organization_id=${organizationId}::uuid`
    )[0]?.bytes ?? 0n,
  );
}
export async function reserveStorage(
  tx: Prisma.TransactionClient,
  organizationId: string,
  attemptId: string,
) {
  await tx.$queryRaw`SELECT id FROM account_organizations WHERE id=${organizationId}::uuid FOR UPDATE`;
  const org = await tx.accountOrganization.findUniqueOrThrow({ where: { id: organizationId } });
  const reserved = await tx.accountStorageReservation.aggregate({
    where: { organizationId },
    _sum: { bytes: true },
  });
  const bytes = 2 * ARTIFACT_JSON_MAX_BYTES;
  if (
    (await storedBytes(tx, organizationId)) + Number(reserved._sum.bytes ?? 0n) + bytes >
    quota(org.planSnapshot).storageBytes
  )
    throw new ConflictException("Account artifact storage capacity exhausted before execution");
  await tx.accountStorageReservation.create({
    data: { attemptId, organizationId, bytes: BigInt(bytes) },
  });
}
