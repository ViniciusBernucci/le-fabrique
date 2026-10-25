import { createHmac, randomUUID } from "node:crypto";
import { createServer } from "node:net";
import type { AccountSession } from "@le-fabrique/contracts";
import { Controller, Get, type INestApplication, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAuthGuard } from "../control/admin-auth.guard";
import { OrchestrationService } from "../orchestration/orchestration.service";
import { PrismaService } from "../prisma.service";
import { RedisService } from "../redis.service";
import { ProviderOnboardingService } from "../settings/provider-onboarding.service";
import { ProviderVerificationService } from "../settings/provider-verification.service";
import { SettingsService } from "../settings/settings.service";
import { WorkerAuthGuard } from "../worker-identity/worker-auth.guard";
import { AccountAuthController, AccountController } from "./account.controller";
import { AccountGuard } from "./account.guard";
import { AccountService } from "./account.service";
import { jobAuthorized } from "./account-access";
import { AccountBillingService } from "./account-billing.service";
import { AccountDataService } from "./account-data.service";
import { AccountEmailService } from "./account-email.service";
import {
  AccountBillingWebhookController,
  AccountFeaturesController,
  AccountRecoveryController,
} from "./account-features.controller";
import { AccountIdentityService } from "./account-identity.service";
import { decryptPrivate, totp } from "./account-private";
import { digest } from "./account-security";
import { reserveStorage } from "./account-storage";
import { AccountWorkController } from "./account-work.controller";
import { AccountWorkService } from "./account-work.service";
import { AccountWorkerController } from "./account-worker.controller";

const databaseUrl = process.env.ACCOUNT_TEST_DATABASE_URL;
class LegacyController {
  read() {
    return { global: true };
  }
}
Controller("legacy-control")(LegacyController);
UseGuards(AdminAuthGuard)(LegacyController);
const legacyDescriptor = Object.getOwnPropertyDescriptor(LegacyController.prototype, "read");
if (!legacyDescriptor) throw new Error("Fixture route missing");
Get()(LegacyController.prototype, "read", legacyDescriptor);
type Client = { cookie: string; state: AccountSession };
describe.skipIf(!databaseUrl)(
  "account HTTP and PostgreSQL isolation (ephemeral database only)",
  () => {
    let app: INestApplication;
    let base: string;
    let prisma: PrismaClient;
    let accounts: AccountService;
    let identity: AccountIdentityService;
    let email: AccountEmailService;
    let billing: AccountBillingService;
    const redis = { ensureConnected: vi.fn(), eval: vi.fn().mockResolvedValue(1) };
    async function request(
      path: string,
      method = "GET",
      body?: unknown,
      client?: Client,
      overrides?: Record<string, string>,
    ) {
      return fetch(`${base}${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Account-Request": "1",
          ...(client
            ? {
                Cookie: client.cookie,
                "X-Account-CSRF": client.state.csrfToken,
                ...(path !== "/account/session"
                  ? { "X-Account-Organization": client.state.organization.id }
                  : {}),
              }
            : {}),
          ...overrides,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    }
    async function register(label: string): Promise<Client> {
      const response = await request("/account/register", "POST", {
        name: label,
        email: `${label.toLowerCase()}@example.test`,
        password: "fixture-password-123",
        organizationName: `${label} team`,
      });
      expect(response.status).toBe(201);
      const cookie = response.headers.get("set-cookie")?.split(";")[0] ?? "";
      const state = (await response.json()) as AccountSession;
      expect(response.headers.get("set-cookie")).toContain("HttpOnly");
      expect(response.headers.get("set-cookie")).toContain("SameSite=Strict");
      expect(response.headers.get("cache-control")).toBe("no-store");
      await prisma.accountUser.update({
        where: { id: state.user.id },
        data: { emailVerifiedAt: new Date() },
      });
      return { cookie, state };
    }
    async function invite(owner: Client, email: string, role = "READER") {
      const response = await request("/account/invitations", "POST", { email, role }, owner);
      expect(response.status).toBe(201);
      return response.json() as Promise<{ token: string; invitation: { id: string } }>;
    }
    beforeAll(async () => {
      if (!databaseUrl || !new URL(databaseUrl).pathname.endsWith("/account_test"))
        throw new Error("Use a dedicated account_test database.");
      prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
      await prisma.$connect();
      const module = await Test.createTestingModule({
        controllers: [
          AccountAuthController,
          AccountController,
          LegacyController,
          AccountWorkController,
          AccountRecoveryController,
          AccountFeaturesController,
          AccountBillingWebhookController,
          AccountWorkerController,
        ],
        providers: [
          AccountService,
          AccountWorkService,
          AccountDataService,
          AccountIdentityService,
          AccountEmailService,
          AccountBillingService,
          ProviderOnboardingService,
          ProviderVerificationService,
          AccountGuard,
          WorkerAuthGuard,
          AdminAuthGuard,
          { provide: PrismaService, useValue: prisma },
          { provide: RedisService, useValue: redis },
          {
            provide: ConfigService,
            useValue: {
              get: (name: string) => (name === "NODE_ENV" ? "test" : undefined),
              getOrThrow: (name: string) =>
                name === "WORKER_API_TOKEN"
                  ? "fixture-worker-token-at-least-32-characters"
                  : "fixture-administrative-token-at-least-32-characters",
            },
          },
        ],
      }).compile();
      accounts = module.get(AccountService);
      identity = module.get(AccountIdentityService);
      email = module.get(AccountEmailService);
      billing = module.get(AccountBillingService);
      app = module.createNestApplication({ rawBody: true });
      await app.listen(0, "127.0.0.1");
      base = await app.getUrl();
    });
    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });
    beforeEach(async () => {
      redis.eval.mockResolvedValue(1);
      redis.ensureConnected.mockReset();
      await prisma.$executeRawUnsafe(
        "TRUNCATE account_users, account_organizations, factory_settings, account_email_jobs, account_billing_events, worker_identities CASCADE",
      );
    });
    afterAll(async () => {
      await app?.close();
      await prisma?.$disconnect();
    });
    it("creates only account-owned data and denies both directions of legacy auth", async () => {
      const alice = await register("Alice");
      const stored = await prisma.accountUser.findUniqueOrThrow({
        where: { id: alice.state.user.id },
      });
      expect(stored.passwordHash).not.toBe("fixture-password-123");
      expect(JSON.stringify(alice.state)).not.toMatch(/passwordHash|tokenHash|password_hash/);
      expect(
        (
          await request("/account/session", "GET", undefined, undefined, {
            Authorization: "Bearer fixture-administrative-token-at-least-32-characters",
          })
        ).status,
      ).toBe(401);
      expect((await request("/legacy-control", "GET", undefined, alice)).status).toBe(401);
      const overview = await (await request("/account/overview", "GET", undefined, alice)).json();
      expect(overview.usage).toMatchObject({ activeMembers: 1, projects: 0, aiUsage: null });
      expect(overview.plan.status).toBe("NONE");
    });
    it("rejects missing CSRF, cross-origin requests and stale active-account selection", async () => {
      const alice = await register("Alice");
      const input = { expectedVersion: 1, name: "Updated team" };
      expect(
        (await request("/account/organization", "PUT", input, alice, { "X-Account-CSRF": "wrong" }))
          .status,
      ).toBe(403);
      expect(
        (
          await request("/account/organization", "PUT", input, alice, {
            "X-Account-Organization": crypto.randomUUID(),
          })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(
            "/account/login",
            "POST",
            { email: "alice@example.test", password: "fixture-password-123" },
            undefined,
            { Origin: "https://evil.test" },
          )
        ).status,
      ).toBe(403);
      expect(
        await prisma.accountOrganization.findUniqueOrThrow({
          where: { id: alice.state.organization.id },
        }),
      ).toMatchObject({ name: "Alice team", version: 1 });
    });
    it("does not disclose or mutate another organization's members, invitations or history", async () => {
      const alice = await register("Alice");
      const bob = await register("Bob");
      const bobMember = await prisma.accountMembership.findFirstOrThrow({
        where: { userId: bob.state.user.id },
      });
      const bobInvite = await invite(bob, "guest@example.test");
      expect(
        (
          await request(
            `/account/members/${bobMember.id}`,
            "PATCH",
            { expectedVersion: 1, role: "READER", status: "SUSPENDED" },
            alice,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(
            `/account/invitations/${bobInvite.invitation.id}`,
            "DELETE",
            undefined,
            alice,
          )
        ).status,
      ).toBe(404);
      expect(
        (
          await request(
            "/account/session/organization",
            "PUT",
            { organizationId: bob.state.organization.id },
            alice,
          )
        ).status,
      ).toBe(404);
      const data = await (await request("/account/overview", "GET", undefined, alice)).json();
      expect(data.members).toHaveLength(1);
      expect(JSON.stringify(data)).not.toContain("Bob");
    });
    it("accepts a private invitation once under concurrent requests and checks invited email", async () => {
      const alice = await register("Alice");
      const bob = await register("Bob");
      const eve = await register("Eve");
      const invitation = await invite(alice, "bob@example.test");
      expect(
        (await request("/account/invitations/accept", "POST", { token: invitation.token }, eve))
          .status,
      ).toBe(404);
      const responses = await Promise.all([
        request("/account/invitations/accept", "POST", { token: invitation.token }, bob),
        request("/account/invitations/accept", "POST", { token: invitation.token }, bob),
      ]);
      expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
      expect(
        await prisma.accountMembership.count({
          where: { userId: bob.state.user.id, organizationId: alice.state.organization.id },
        }),
      ).toBe(1);
      const record = await prisma.accountInvitation.findUniqueOrThrow({
        where: { id: invitation.invitation.id },
      });
      expect(record.tokenHash).toBe(digest(invitation.token));
      expect(record.status).toBe("ACCEPTED");
    });
    it("denies expired/revoked invitations and invalidates replaced invitation links", async () => {
      const alice = await register("Alice");
      const bob = await register("Bob");
      const first = await invite(alice, "bob@example.test");
      const second = await invite(alice, "bob@example.test");
      expect(
        (await request("/account/invitations/accept", "POST", { token: first.token }, bob)).status,
      ).toBe(404);
      await prisma.accountInvitation.update({
        where: { id: second.invitation.id },
        data: { expiresAt: new Date(Date.now() - 1) },
      });
      expect(
        (await request("/account/invitations/accept", "POST", { token: second.token }, bob)).status,
      ).toBe(404);
      expect(await prisma.accountMembership.count({ where: { userId: bob.state.user.id } })).toBe(
        1,
      );
    });
    it("protects owners, restricts admin escalation and revokes suspended-member access", async () => {
      const alice = await register("Alice");
      const bob = await register("Bob");
      const ownerMember = await prisma.accountMembership.findFirstOrThrow({
        where: { userId: alice.state.user.id },
      });
      expect(
        (
          await request(
            `/account/members/${ownerMember.id}`,
            "PATCH",
            { expectedVersion: 1, role: "READER", status: "REMOVED" },
            alice,
          )
        ).status,
      ).toBe(403);
      const invitation = await invite(alice, "bob@example.test", "ADMIN");
      expect(
        (await request("/account/invitations/accept", "POST", { token: invitation.token }, bob))
          .status,
      ).toBe(201);
      bob.state = (await (
        await request("/account/session", "GET", undefined, bob)
      ).json()) as AccountSession;
      expect(
        (
          await request(
            "/account/invitations",
            "POST",
            { email: "eve@example.test", role: "ADMIN" },
            bob,
          )
        ).status,
      ).toBe(403);
      const member = await prisma.accountMembership.findFirstOrThrow({
        where: { userId: bob.state.user.id, organizationId: alice.state.organization.id },
      });
      expect(
        (
          await request(
            `/account/members/${member.id}`,
            "PATCH",
            { expectedVersion: 1, role: "ADMIN", status: "SUSPENDED" },
            alice,
          )
        ).status,
      ).toBe(200);
      expect((await request("/account/session", "GET", undefined, bob)).status).toBe(401);
    });
    it("detects stale versions and records changes transactionally", async () => {
      const alice = await register("Alice");
      expect(
        (
          await request(
            "/account/organization",
            "PUT",
            { expectedVersion: 1, name: "Renamed" },
            alice,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await request(
            "/account/organization",
            "PUT",
            { expectedVersion: 1, name: "Stale" },
            alice,
          )
        ).status,
      ).toBe(409);
      expect(
        await prisma.accountAuditEvent.count({ where: { action: "ORGANIZATION_UPDATED" } }),
      ).toBe(1);
      const profile = {
        expectedVersion: 1,
        name: "Alice Two",
        preferences: { ...alice.state.user.preferences, timeZone: "UTC" },
      };
      expect((await request("/account/profile", "PUT", profile, alice)).status).toBe(200);
      const state = await (await request("/account/session", "GET", undefined, alice)).json();
      expect(state.user).toMatchObject({ name: "Alice Two", version: 2 });
    });
    it("changes password only with current credentials and revokes other sessions", async () => {
      const alice = await register("Alice");
      const login = await request("/account/login", "POST", {
        email: "alice@example.test",
        password: "fixture-password-123",
      });
      expect(login.status).toBe(201);
      const other: Client = {
        cookie: login.headers.get("set-cookie")?.split(";")[0] ?? "",
        state: (await login.json()) as AccountSession,
      };
      expect(
        (
          await request(
            "/account/password",
            "PUT",
            { currentPassword: "wrong", newPassword: "new-password-123" },
            alice,
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await request(
            "/account/password",
            "PUT",
            { currentPassword: "fixture-password-123", newPassword: "new-password-123" },
            alice,
          )
        ).status,
      ).toBe(200);
      expect((await request("/account/session", "GET", undefined, other)).status).toBe(401);
      expect((await request("/account/session", "GET", undefined, alice)).status).toBe(200);
      expect(
        (
          await request("/account/login", "POST", {
            email: "alice@example.test",
            password: "fixture-password-123",
          })
        ).status,
      ).toBe(401);
      expect((await request("/account/logout", "POST", undefined, alice)).status).toBe(201);
      expect((await request("/account/session", "GET", undefined, alice)).status).toBe(401);
    });
    it("sanitizes database errors without exposing or logging private query arguments", async () => {
      const alice = await register("Alice");
      const failure = vi
        .spyOn(accounts, "overview")
        .mockRejectedValueOnce(new Error("private session token and account query arguments"));
      const response = await request("/account/overview", "GET", undefined, alice);
      expect(response.status).toBe(503);
      const text = await response.text();
      expect(text).not.toContain("private");
      expect(text).toContain("temporariamente indisponível");
      failure.mockRestore();
    });
    it("fails closed on unavailable rate limiting and bounds authentication attempts", async () => {
      redis.eval.mockResolvedValue(11);
      expect(
        (
          await request("/account/register", "POST", {
            name: "Alice",
            email: "alice@example.test",
            password: "fixture-password-123",
            organizationName: "Team",
          })
        ).status,
      ).toBe(429);
      redis.eval.mockRejectedValue(new Error("private redis connection detail"));
      const response = await request("/account/login", "POST", {
        email: "alice@example.test",
        password: "fixture-password-123",
      });
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain("private redis");
      expect(await prisma.accountUser.count()).toBe(0);
    });
    async function join(owner: Client, member: Client, role = "READER") {
      const { token } = await invite(owner, member.state.user.email, role);
      const accepted = await request("/account/invitations/accept", "POST", { token }, member);
      expect(accepted.status).toBe(201);
      member.state = await (await request("/account/session", "GET", undefined, member)).json();
      return await prisma.accountMembership.findUniqueOrThrow({
        where: {
          organizationId_userId: {
            organizationId: owner.state.organization.id,
            userId: member.state.user.id,
          },
        },
      });
    }
    async function project(owner: Client, label = "Private project") {
      const r = await request(
        "/account/work/projects",
        "POST",
        { name: label, repoUrl: "https://github.com/fixture/example", baseRef: "a".repeat(40) },
        owner,
      );
      expect(r.status).toBe(201);
      return r.json() as Promise<{ id: string }>;
    }
    function smtpConfig() {
      vi.stubEnv("ACCOUNT_DATA_ENCRYPTION_KEY", "01".repeat(32));
      vi.stubEnv("ACCOUNT_SMTP_ENABLED", "true");
      vi.stubEnv("ACCOUNT_SMTP_HOST", "127.0.0.1");
      vi.stubEnv("ACCOUNT_EMAIL_FROM", "accounts@example.test");
      vi.stubEnv("ACCOUNT_PUBLIC_URL", "http://localhost/account");
      vi.stubEnv("ACCOUNT_SMTP_USER", "");
      vi.stubEnv("NODE_ENV", "test");
    }
    it("isolates owned projects, project grants, definitions, tickets and exports over HTTP", async () => {
      const a = await register("Alice"),
        b = await register("Bob");
      const pr = await project(a);
      expect(await (await request("/account/work/projects", "GET", undefined, b)).json()).toEqual(
        [],
      );
      for (const suffix of ["tickets", "definition", "runs", "events", "grants", "routes"]) {
        expect(
          (await request(`/account/work/projects/${pr.id}/${suffix}`, "GET", undefined, b)).status,
        ).toBe(404);
      }
      const exportPage = await (
        await request("/account/data/export?section=projects", "GET", undefined, b)
      ).json();
      expect(exportPage.rows).toEqual([]);
      const attemptsExport = await request(
        "/account/data/export?section=attempts",
        "GET",
        undefined,
        b,
      );
      expect(attemptsExport.status).toBe(200);
      expect((await attemptsExport.json()).rows).toEqual([]);
      const m = await join(a, b);
      expect(
        (await (await request("/account/overview", "GET", undefined, b)).json()).usage.projects,
      ).toBe(0);
      expect(
        (await request(`/account/work/projects/${pr.id}/tickets`, "GET", undefined, b)).status,
      ).toBe(403);
      expect(
        (
          await request(
            `/account/work/projects/${pr.id}/grants`,
            "PUT",
            { membershipId: m.id, role: "READER" },
            a,
          )
        ).status,
      ).toBe(200);
      expect(
        (await request(`/account/work/projects/${pr.id}/tickets`, "GET", undefined, b)).status,
      ).toBe(200);
      expect(
        (
          await request(
            `/account/work/projects/${pr.id}/tickets`,
            "POST",
            { title: "Example", objective: "A task", acceptanceCriteria: ["Verified"] },
            b,
          )
        ).status,
      ).toBe(403);
      expect(
        (await request(`/account/work/projects/${pr.id}/grants/${m.id}`, "DELETE", undefined, a))
          .status,
      ).toBe(200);
      expect(
        (await request(`/account/work/projects/${pr.id}/tickets`, "GET", undefined, b)).status,
      ).toBe(403);
    });
    it("requires verified invitation recipients and prevents foreign compound grants in PostgreSQL", async () => {
      const a = await register("Alice"),
        b = await register("Bob");
      const { token } = await invite(a, b.state.user.email);
      await prisma.accountUser.update({
        where: { id: b.state.user.id },
        data: { emailVerifiedAt: null },
      });
      expect((await request("/account/invitations/accept", "POST", { token }, b)).status).toBe(404);
      const pr = await project(a);
      const mb = await prisma.accountMembership.findFirstOrThrow({
        where: { userId: b.state.user.id },
      });
      await expect(
        prisma.accountProjectGrant.create({
          data: {
            organizationId: a.state.organization.id,
            projectId: pr.id,
            membershipId: mb.id,
            role: "READER",
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    });
    it("serializes concurrent quota admission and applies the persisted plan", async () => {
      const a = await register("Alice");
      const plan = {
        id: "fixture",
        name: "Fixture",
        version: 1,
        priceMinor: 0,
        currency: "EUR",
        interval: "month",
        stripePriceId: null,
        members: 1,
        projects: 1,
        storageBytes: 100000000,
      };
      await prisma.accountOrganization.update({
        where: { id: a.state.organization.id },
        data: { planId: plan.id, planSnapshot: plan, subscriptionStatus: "FREE" },
      });
      const responses = await Promise.all([
        request(
          "/account/work/projects",
          "POST",
          { name: "First", repoUrl: "https://github.com/fixture/one", baseRef: "a".repeat(40) },
          a,
        ),
        request(
          "/account/work/projects",
          "POST",
          { name: "Second", repoUrl: "https://github.com/fixture/two", baseRef: "a".repeat(40) },
          a,
        ),
      ]);
      expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(
        (
          await request(
            "/account/invitations",
            "POST",
            { email: "other@example.test", role: "READER" },
            a,
          )
        ).status,
      ).toBe(409);
    });
    it("encrypts private integrations, sanitizes exports and refuses cross-account grants and onboarding", async () => {
      vi.stubEnv("ACCOUNT_DATA_ENCRYPTION_KEY", "01".repeat(32));
      const a = await register("Alice"),
        b = await register("Bob");
      const pr = await project(a);
      const response = await request(
        "/account/integrations",
        "POST",
        {
          name: "My GitHub",
          provider: "GITHUB",
          mode: "GITHUB_TOKEN",
          secret: "fixture-secret-do-not-export",
          models: [],
          subscriptionLabel: "GitHub",
          fixedCostMinor: null,
          currency: "EUR",
        },
        a,
      );
      expect(response.status).toBe(201);
      const i = await response.json();
      expect(
        (await prisma.accountIntegration.findUniqueOrThrow({ where: { id: i.id } }))
          .secretEncrypted,
      ).not.toContain("fixture-secret-do-not-export");
      for (const route of ["/account/integrations", "/account/data/export?section=integrations"]) {
        const text = await (await request(route, "GET", undefined, a)).text();
        expect(text).not.toContain("fixture-secret-do-not-export");
        expect(text).not.toContain("secretEncrypted");
      }
      expect(
        (
          await request(
            `/account/integrations/${i.id}/projects/${pr.id}`,
            "PUT",
            { enabled: true },
            b,
          )
        ).status,
      ).toBe(404);
      expect(
        (await request(`/account/integrations/${i.id}/login`, "POST", undefined, b)).status,
      ).toBe(404);
      expect(
        (
          await request(
            `/account/integrations/${i.id}/projects/${pr.id}`,
            "PUT",
            { enabled: true },
            a,
          )
        ).status,
      ).toBe(200);
    });
    it("persists notifications from real status changes and honors preference and access revocation", async () => {
      const a = await register("Alice"),
        b = await register("Bob");
      const pr = await project(a);
      const m = await join(a, b);
      await prisma.accountProjectGrant.create({
        data: {
          organizationId: a.state.organization.id,
          projectId: pr.id,
          membershipId: m.id,
          role: "READER",
        },
      });
      const ticket = await prisma.ticket.create({
        data: {
          projectId: pr.id,
          title: "Real task",
          objective: "Observed change",
          acceptanceCriteria: ["works"],
        },
      });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "READY" } });
      const notes = await (await request("/account/notifications", "GET", undefined, b)).json();
      expect(notes).toHaveLength(1);
      expect(notes[0].body).toContain("READY");
      await prisma.accountProjectGrant.deleteMany({ where: { membershipId: m.id } });
      expect(await (await request("/account/notifications", "GET", undefined, b)).json()).toEqual(
        [],
      );
      await prisma.accountUser.update({
        where: { id: a.state.user.id },
        data: {
          preferences: {
            locale: "pt-BR",
            timeZone: "UTC",
            deliveryNotifications: false,
            executionNotifications: false,
          },
        },
      });
      await prisma.ticket.update({ where: { id: ticket.id }, data: { status: "RUNNING" } });
      expect(await prisma.accountNotification.count({ where: { userId: a.state.user.id } })).toBe(
        1,
      );
    });
    it("enforces second factors, anti-replay and single-use recovery codes", async () => {
      vi.stubEnv("ACCOUNT_DATA_ENCRYPTION_KEY", "01".repeat(32));
      const a = await register("Alice");
      const principal = await accounts.authenticate(a.cookie.split("=")[1] ?? "");
      const prepared = await identity.prepareMfa(principal, { password: "fixture-password-123" });
      const confirmed = await identity.confirmMfa(
        principal,
        totp(prepared.secret, BigInt(Math.floor(Date.now() / 30000))),
      );
      const input = { email: a.state.user.email, password: "fixture-password-123" };
      expect((await request("/account/login", "POST", input)).status).toBe(403);
      expect(
        (
          await request("/account/login", "POST", {
            ...input,
            otp: totp(prepared.secret, BigInt(Math.floor(Date.now() / 30000))),
          })
        ).status,
      ).toBe(403);
      const recovery = confirmed.recoveryCodes[0];
      expect(
        (await request("/account/login", "POST", { ...input, recoveryCode: recovery })).status,
      ).toBe(201);
      expect(
        (await request("/account/login", "POST", { ...input, recoveryCode: recovery })).status,
      ).toBe(403);
      const stored = await prisma.accountUser.findUniqueOrThrow({ where: { id: a.state.user.id } });
      expect(JSON.stringify(stored.recoveryHashes)).not.toContain(recovery);
    });
    it("consumes encrypted email tokens once, resets passwords and revokes all old sessions", async () => {
      smtpConfig();
      const a = await register("Alice");
      await identity.recover(a.state.user.email);
      const job = await prisma.accountEmailJob.findFirstOrThrow();
      const token = /account-reset=([a-f0-9]{64})/.exec(
        decryptPrivate(job.encryptedBody, `email:${job.id}`),
      )?.[1];
      expect(token).toBeDefined();
      await identity.consume(token ?? "", "new-fixture-password-123");
      expect(await prisma.accountSession.count({ where: { userId: a.state.user.id } })).toBe(0);
      await expect(identity.consume(token ?? "", "other-fixture-password-123")).rejects.toThrow();
      expect(
        (
          await request("/account/login", "POST", {
            email: a.state.user.email,
            password: "fixture-password-123",
          })
        ).status,
      ).toBe(401);
      expect(
        (
          await request("/account/login", "POST", {
            email: a.state.user.email,
            password: "new-fixture-password-123",
          })
        ).status,
      ).toBe(201);
    });
    it("serializes password recovery requests so replaced links cannot remain active", async () => {
      smtpConfig();
      const a = await register("Alice");
      await Promise.all([
        identity.recover(a.state.user.email),
        identity.recover(a.state.user.email),
      ]);
      expect(
        await prisma.accountSecurityToken.count({
          where: { userId: a.state.user.id, kind: "RESET_PASSWORD", usedAt: null },
        }),
      ).toBe(1);
      expect(await prisma.accountEmailJob.count()).toBe(2);
    });
    it("delivers the encrypted outbox through a local fake SMTP server and clears the body", async () => {
      smtpConfig();
      let received = "";
      const server = createServer((socket) => {
        socket.setEncoding("utf8");
        socket.write("220 fixture SMTP\r\n");
        let buffer = "",
          data = false;
        socket.on("data", (chunk) => {
          buffer += chunk;
          while (buffer.includes("\r\n")) {
            const idx = buffer.indexOf("\r\n"),
              line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (data) {
              if (line === ".") {
                data = false;
                socket.write("250 stored\r\n");
              } else received += `${line}\n`;
            } else if (line.startsWith("EHLO")) socket.write("250 fixture\r\n");
            else if (line === "DATA") {
              data = true;
              socket.write("354 continue\r\n");
            } else if (line === "QUIT") {
              socket.end("221 bye\r\n");
            } else socket.write("250 ok\r\n");
          }
        });
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("SMTP fixture unavailable");
      vi.stubEnv("ACCOUNT_SMTP_PORT", String(address.port));
      try {
        await prisma.$transaction((tx) =>
          email.enqueue(tx, "recipient@example.test", "Fixture message", "fixture-body"),
        );
        await email.flush();
        expect(received).toContain("fixture-body");
        const job = await prisma.accountEmailJob.findFirstOrThrow();
        expect(job.status).toBe("SENT");
        expect(job.encryptedBody).toBe("");
      } finally {
        await new Promise<void>((resolve, reject) =>
          server.close((err) => (err ? reject(err) : resolve())),
        );
      }
    });
    it("requires recipient acceptance for ownership transfer and keeps exactly one owner", async () => {
      const a = await register("Alice"),
        b = await register("Bob");
      const member = await join(a, b);
      smtpConfig();
      expect(
        (
          await request(
            "/account/ownership/transfer",
            "POST",
            { membershipId: member.id, password: "fixture-password-123" },
            a,
          )
        ).status,
      ).toBe(201);
      const job = await prisma.accountEmailJob.findFirstOrThrow({
        where: { subject: "Transferência da conta La fabrique" },
      });
      const token = /account-transfer=([a-f0-9]{64})/.exec(
        decryptPrivate(job.encryptedBody, `email:${job.id}`),
      )?.[1];
      expect(
        (
          await request(
            "/account/ownership/accept",
            "POST",
            { token, password: "fixture-password-123" },
            b,
          )
        ).status,
      ).toBe(201);
      expect(
        await prisma.accountMembership.count({
          where: { organizationId: a.state.organization.id, role: "OWNER" },
        }),
      ).toBe(1);
      expect(
        (await prisma.accountMembership.findUniqueOrThrow({ where: { id: member.id } })).role,
      ).toBe("OWNER");
      expect(
        (
          await request(
            "/account/ownership/accept",
            "POST",
            { token, password: "fixture-password-123" },
            b,
          )
        ).status,
      ).toBe(409);
    });
    it("archives only the user's own inactive organization and invalidates its sessions", async () => {
      const a = await register("Alice"),
        b = await register("Bob");
      expect(
        (await request("/account/archive", "POST", { password: "fixture-password-123" }, a)).status,
      ).toBe(201);
      expect((await request("/account/session", "GET", undefined, a)).status).toBe(401);
      expect((await request("/account/session", "GET", undefined, b)).status).toBe(200);
      expect(
        (
          await prisma.accountOrganization.findUniqueOrThrow({
            where: { id: a.state.organization.id },
          })
        ).archivedAt,
      ).not.toBeNull();
    });

    async function authorityFixture() {
      vi.stubEnv("ACCOUNT_DATA_ENCRYPTION_KEY", "01".repeat(32));
      const a = await register("Alice"),
        b = await register("Bob");
      const member = await join(a, b, "OPERATOR");
      const pr = await project(a);
      await request(
        `/account/work/projects/${pr.id}/grants`,
        "PUT",
        { membershipId: member.id, role: "OPERATOR" },
        a,
      );
      const ids: string[] = [];
      for (const provider of ["CODEX", "CLAUDE", "GITHUB"]) {
        const r = await request(
          "/account/integrations",
          "POST",
          {
            name: provider,
            provider,
            mode: provider === "GITHUB" ? "GITHUB_TOKEN" : "SUBSCRIPTION_CLI",
            models: provider === "GITHUB" ? [] : ["fixture-model"],
            subscriptionLabel: "Fixture",
            fixedCostMinor: null,
            currency: "EUR",
            ...(provider === "GITHUB" ? { secret: "fixture-private-github-token" } : {}),
          },
          a,
        );
        expect(r.status).toBe(201);
        const integration = await r.json();
        ids.push(integration.id);
        await request(
          `/account/integrations/${integration.id}/projects/${pr.id}`,
          "PUT",
          { enabled: true },
          a,
        );
      }
      const integrations = await prisma.accountIntegration.findMany({ where: { id: { in: ids } } });
      const assignments = [
        "PLANNER",
        "DEVELOPER",
        "REVIEWER",
        "QA",
        "DOCUMENTATION",
        "SECURITY",
      ].map((role) => ({
        role,
        enabled: ["DEVELOPER", "REVIEWER"].includes(role),
        installationId:
          role === "DEVELOPER"
            ? integrations.find((i) => i.provider === "CODEX")?.runtimeId
            : role === "REVIEWER"
              ? integrations.find((i) => i.provider === "CLAUDE")?.runtimeId
              : null,
        model: ["DEVELOPER", "REVIEWER"].includes(role) ? "fixture-model" : null,
        permissionMode: role === "DEVELOPER" ? "WORKSPACE_WRITE" : "READ_ONLY",
        timeoutMinutes: 15,
        maxAttempts: 2,
      }));
      expect(
        (await request(`/account/work/projects/${pr.id}/routes`, "PUT", assignments, a)).status,
      ).toBe(200);
      const ticket = await prisma.ticket.create({
        data: {
          projectId: pr.id,
          title: "Authorized fixture",
          objective: "Test authority",
          acceptanceCriteria: ["safe"],
          status: "RUNNING",
        },
      });
      await prisma.accountJobAuthority.create({
        data: {
          ticketId: ticket.id,
          projectId: pr.id,
          organizationId: a.state.organization.id,
          userId: b.state.user.id,
        },
      });
      const run = await prisma.run.create({
        data: {
          ticketId: ticket.id,
          dispatchEventId: randomUUID(),
          status: "RUNNING",
          nextFencingToken: 1,
        },
      });
      const worker = await prisma.workerIdentity.create({
        data: {
          id: randomUUID(),
          name: "Fixture worker",
          capabilities: {},
          os: "linux",
          arch: "x64",
          nodeVersion: "fixture",
          lastHeartbeatAt: new Date(),
        },
      });
      const attempt = await prisma.attempt.create({
        data: {
          runId: run.id,
          workerId: worker.id,
          sequence: 1,
          fencingToken: 1,
          leaseExpiresAt: new Date(Date.now() + 60000),
        },
      });
      return { a, b, member, pr, ticket, run, worker, attempt, integrations };
    }
    it("routes workers only to account installations and pauses after revocation without clearing the writer", async () => {
      const f = await authorityFixture();
      const snapshot = await new SettingsService(prisma as never).getWorkerConfigurationSnapshot(
        new Date(),
        f.pr.id,
      );
      expect(snapshot.configuration.installations).toHaveLength(2);
      expect(
        snapshot.configuration.installations.every((i) =>
          f.integrations.some((v) => v.runtimeId === i.id),
        ),
      ).toBe(true);
      expect(
        await prisma.$transaction((tx) =>
          jobAuthorized(tx, f.ticket.id, f.a.state.organization.id),
        ),
      ).toBe(true);
      const endpoint = `/internal/account-repositories/${f.attempt.id}/credential`;
      expect(
        (await request(endpoint, "POST", { workerId: f.worker.id, fencingToken: 1 }, f.a)).status,
      ).toBe(401);
      const auth = { Authorization: "Bearer fixture-worker-token-at-least-32-characters" };
      expect(
        (
          await request(
            endpoint,
            "POST",
            { workerId: f.worker.id, fencingToken: 2 },
            undefined,
            auth,
          )
        ).status,
      ).toBe(409);
      const credential = await request(
        endpoint,
        "POST",
        { workerId: f.worker.id, fencingToken: 1 },
        undefined,
        auth,
      );
      expect(credential.status).toBe(201);
      expect(await credential.json()).toEqual({
        scoped: true,
        token: "fixture-private-github-token",
      });
      expect(credential.headers.get("cache-control")).toBe("no-store");
      const exportedResponse = await request(
        "/account/data/export?section=attempts",
        "GET",
        undefined,
        f.a,
      );
      expect(exportedResponse.status).toBe(200);
      const exported = await exportedResponse.json();
      expect(exported.rows).toHaveLength(1);
      expect(exported.rows[0]).toMatchObject({ id: f.attempt.id, runId: f.run.id });
      expect(JSON.stringify(exported)).not.toMatch(
        /workerId|fencingToken|fixture-private-github-token/,
      );

      expect(
        (
          await request(
            `/account/members/${f.member.id}`,
            "PATCH",
            { expectedVersion: f.member.version, role: "OPERATOR", status: "SUSPENDED" },
            f.a,
          )
        ).status,
      ).toBe(200);
      const renewal = await new OrchestrationService(prisma as never).renew(f.attempt.id, {
        workerId: f.worker.id,
        fencingToken: 1,
        leaseDurationMs: 90000,
      });
      expect(renewal.controlAction).toBe("PAUSE");
      expect(
        (await prisma.attempt.findUniqueOrThrow({ where: { id: f.attempt.id } })).stoppedConfirmed,
      ).toBe(false);
      expect(
        await prisma.$transaction((tx) =>
          jobAuthorized(tx, f.ticket.id, f.a.state.organization.id),
        ),
      ).toBe(false);
      expect(
        (
          await request(
            endpoint,
            "POST",
            { workerId: f.worker.id, fencingToken: 1 },
            undefined,
            auth,
          )
        ).status,
      ).toBe(409);
    });
    it("reserves storage before a writer is admitted and rejects capacity exhaustion", async () => {
      const f = await authorityFixture();
      await prisma.$transaction((tx) =>
        reserveStorage(tx, f.a.state.organization.id, f.attempt.id),
      );
      expect(
        Number(
          (
            await prisma.accountStorageReservation.findUniqueOrThrow({
              where: { attemptId: f.attempt.id },
            })
          ).bytes,
        ),
      ).toBe(16777216);
      const org = await prisma.accountOrganization.findUniqueOrThrow({
        where: { id: f.a.state.organization.id },
      });
      await prisma.accountOrganization.update({
        where: { id: org.id },
        data: {
          planSnapshot: {
            id: "small",
            name: "Small fixture",
            version: 1,
            priceMinor: 0,
            currency: "EUR",
            interval: "month",
            stripePriceId: null,
            members: 3,
            projects: 3,
            storageBytes: 1000,
          },
        },
      });
      await prisma.accountStorageReservation.deleteMany({ where: { attemptId: f.attempt.id } });
      await expect(
        prisma.$transaction((tx) => reserveStorage(tx, org.id, f.attempt.id)),
      ).rejects.toThrow("capacity");
      expect(await prisma.accountStorageReservation.count()).toBe(0);
    });
    function stripeConfig() {
      smtpConfig();
      vi.stubEnv("ACCOUNT_STRIPE_ENABLED", "true");
      vi.stubEnv("ACCOUNT_STRIPE_SECRET_KEY", "sk_test_fixture_only");
      vi.stubEnv("ACCOUNT_STRIPE_WEBHOOK_SECRET", "whsec_fixture_only");
      const plan = {
        id: "paid-fixture",
        name: "Paid fixture",
        version: 1,
        priceMinor: 1000,
        currency: "EUR",
        interval: "month",
        stripePriceId: "price_fixture",
        members: 10,
        projects: 10,
        storageBytes: 100000000,
      };
      vi.stubEnv("ACCOUNT_PLAN_CATALOG", JSON.stringify([plan]));
      return plan;
    }
    it("verifies raw HTTP webhooks, deduplicates events and consults the latest subscription when events arrive out of order", async () => {
      const a = await register("Alice");
      const plan = stripeConfig();
      await prisma.accountOrganization.update({
        where: { id: a.state.organization.id },
        data: { stripeSubscriptionId: "sub_fixture", stripeCustomerId: "cus_fixture" },
      });
      const realFetch = globalThis.fetch;
      let status = "active";
      const stripeFetch = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              id: "sub_fixture",
              status,
              metadata: { account_organization_id: a.state.organization.id },
              items: {
                data: [{ price: { id: plan.stripePriceId }, current_period_end: 1800000000 }],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      );
      vi.stubGlobal("fetch", stripeFetch);
      async function event(id: string, oldStatus: string, valid = true) {
        const raw = JSON.stringify({
          id,
          type: "customer.subscription.updated",
          data: { object: { id: "sub_fixture", status: oldStatus } },
        });
        const stamp = String(Math.floor(Date.now() / 1000));
        const signature = createHmac("sha256", "whsec_fixture_only")
          .update(`${stamp}.${raw}`)
          .digest("hex");
        return realFetch(`${base}/account/billing/webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Stripe-Signature": `t=${stamp},v1=${valid ? signature : "0".repeat(64)}`,
          },
          body: raw,
        });
      }
      expect((await event("evt_first", "canceled")).status).toBe(201);
      expect(
        (
          await prisma.accountOrganization.findUniqueOrThrow({
            where: { id: a.state.organization.id },
          })
        ).subscriptionStatus,
      ).toBe("active");
      expect((await event("evt_first", "canceled")).status).toBe(201);
      expect(stripeFetch).toHaveBeenCalledTimes(1);
      status = "canceled";
      expect((await event("evt_second", "active")).status).toBe(201);
      expect(
        (
          await prisma.accountOrganization.findUniqueOrThrow({
            where: { id: a.state.organization.id },
          })
        ).subscriptionStatus,
      ).toBe("canceled");
      expect((await event("evt_invalid", "active", false)).status).toBe(400);
      expect(await prisma.accountBillingEvent.count()).toBe(2);
    });
    it("preserves a single checkout intent after unknown provider outcome and retries with the same idempotency key", async () => {
      const a = await register("Alice");
      const plan = stripeConfig();
      const principal = await accounts.authenticate(a.cookie.split("=")[1] ?? "");
      const requestId = randomUUID();
      let fail = true;
      const keys: string[] = [];
      vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, options: RequestInit) => {
          if (url.includes("/prices/"))
            return new Response(
              JSON.stringify({
                id: "price_fixture",
                unit_amount: 1000,
                currency: "eur",
                recurring: { interval: "month" },
              }),
            );
          if (url.endsWith("/checkout/sessions")) {
            keys.push((options.headers as Record<string, string>)["Idempotency-Key"] ?? "");
            if (fail) return new Response("{}", { status: 503 });
            return new Response(
              JSON.stringify({
                id: "cs_fixture",
                status: "open",
                url: "https://checkout.stripe.com/c/pay/fixture",
              }),
            );
          }
          return new Response(
            JSON.stringify({
              id: "cs_fixture",
              status: "open",
              url: "https://checkout.stripe.com/c/pay/fixture",
            }),
          );
        }),
      );
      await expect(billing.checkout(principal, plan.id, requestId)).rejects.toThrow("Reconcile");
      expect(await prisma.accountBillingIntent.count()).toBe(1);
      await expect(billing.checkout(principal, plan.id, randomUUID())).rejects.toThrow("pendente");
      fail = false;
      expect(await billing.checkout(principal, plan.id, requestId)).toMatchObject({
        url: "https://checkout.stripe.com/c/pay/fixture",
        selected: false,
      });
      expect(keys).toEqual([`account-plan-${requestId}`, `account-plan-${requestId}`]);
      expect(await prisma.accountBillingIntent.count()).toBe(1);
      expect(await billing.checkout(principal, plan.id, requestId)).toMatchObject({
        url: "https://checkout.stripe.com/c/pay/fixture",
      });
    });
  },
);
