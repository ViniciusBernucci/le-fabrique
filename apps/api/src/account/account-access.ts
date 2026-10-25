import { factoryConfigurationSchema } from "@le-fabrique/contracts";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type { AccountPrincipal } from "./account.service";
export type Access = "READ" | "OPERATE" | "APPROVE" | "MANAGE";
export async function accountRole(tx: Prisma.TransactionClient, p: AccountPrincipal) {
  await tx.$queryRaw`SELECT id FROM account_organizations WHERE id=${p.session.organizationId}::uuid FOR UPDATE`;
  const org = await tx.accountOrganization.findUnique({ where: { id: p.session.organizationId } });
  const m = await tx.accountMembership.findUnique({
    where: {
      organizationId_userId: { organizationId: p.session.organizationId, userId: p.session.userId },
    },
  });
  const session = await tx.accountSession.findUnique({ where: { id: p.session.id } });
  if (
    !org ||
    org.archivedAt ||
    m?.status !== "ACTIVE" ||
    !session ||
    session.expiresAt <= new Date() ||
    session.organizationId !== org.id
  )
    throw new ForbiddenException("Acesso à conta revogado.");
  return { org, m };
}
export async function accountProject(
  tx: Prisma.TransactionClient,
  p: AccountPrincipal,
  id: string,
  access: Access = "READ",
) {
  const { org, m } = await accountRole(tx, p);
  const project = await tx.project.findFirst({ where: { id, organizationId: org.id } });
  if (!project) throw new NotFoundException("Projeto não disponível.");
  const grant = await tx.accountProjectGrant.findUnique({
    where: { projectId_membershipId: { projectId: id, membershipId: m.id } },
  });
  const manager = ["OWNER", "ADMIN"].includes(m.role);
  if (
    !manager &&
    (!grant ||
      access === "MANAGE" ||
      (access === "OPERATE" && (m.role !== "OPERATOR" || grant.role !== "OPERATOR")) ||
      (access === "APPROVE" && (m.role !== "APPROVER" || grant.role !== "APPROVER")))
  )
    throw new ForbiddenException("Seu papel não permite esta operação neste projeto.");
  return { project, org, m };
}
/** Recheck persisted authority without releasing the writer or inventing a physical stop. */
export async function jobAuthorized(
  tx: Prisma.TransactionClient,
  ticketId: string,
  organizationId: string,
): Promise<boolean> {
  await tx.$queryRaw`SELECT id FROM account_organizations WHERE id=${organizationId}::uuid FOR UPDATE`;
  const org = await tx.accountOrganization.findUnique({ where: { id: organizationId } });
  const job = await tx.accountJobAuthority.findUnique({ where: { ticketId } });
  if (!org || org.archivedAt || !job || job.revoked || job.organizationId !== organizationId)
    return false;
  const m = await tx.accountMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId: job.userId } },
  });
  if (m?.status !== "ACTIVE") return false;
  const github = await tx.accountIntegration.findMany({
    where: { organizationId, provider: "GITHUB", mode: "GITHUB_TOKEN", enabled: true },
  });
  if (
    (await tx.accountIntegrationGrant.count({
      where: { projectId: job.projectId, integrationId: { in: github.map((i) => i.id) } },
    })) !== 1
  )
    return false;
  const routes = await tx.accountProjectConfiguration.findUnique({
    where: { projectId: job.projectId },
  });
  const parsed = routes ? factoryConfigurationSchema.safeParse(routes.configuration) : null;
  if (!parsed?.success) return false;
  for (const role of ["DEVELOPER", "REVIEWER"]) {
    const a = parsed.data.assignments.find((a) => a.role === role);
    if (!a?.enabled || !a.installationId) return false;
    for (const runtimeId of [
      a.installationId,
      ...(a.alternatives ?? []).map((a) => a.installationId),
    ]) {
      const i = await tx.accountIntegration.findFirst({
        where: { organizationId, runtimeId, enabled: true, mode: "SUBSCRIPTION_CLI" },
      });
      if (
        !i ||
        !(await tx.accountIntegrationGrant.findUnique({
          where: { integrationId_projectId: { integrationId: i.id, projectId: job.projectId } },
        }))
      )
        return false;
    }
  }
  if (org.stripeSubscriptionId && !["active", "trialing"].includes(org.subscriptionStatus))
    return false;
  if (["OWNER", "ADMIN"].includes(m.role)) return true;
  const grant = await tx.accountProjectGrant.findUnique({
    where: { projectId_membershipId: { projectId: job.projectId, membershipId: m.id } },
  });
  return m.role === "OPERATOR" && grant?.role === "OPERATOR";
}
