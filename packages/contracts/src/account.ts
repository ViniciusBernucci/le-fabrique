import { z } from "zod";

export const accountRoleSchema = z.enum(["OWNER", "ADMIN", "OPERATOR", "APPROVER", "READER"]);
export const accountMemberStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]);
const name = z.string().trim().min(1).max(100);
const email = z.email().trim().toLowerCase().max(254);
const password = z.string().min(12).max(128);
const version = z.number().int().positive();
const id = z.uuid();
const timeZone = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Invalid time zone");
export const accountPreferencesSchema = z
  .object({
    locale: z.enum(["pt-BR", "en-US"]),
    timeZone,
    deliveryNotifications: z.boolean(),
    executionNotifications: z.boolean(),
  })
  .strict();
export const accountRegisterSchema = z
  .object({ name, email, password, organizationName: name })
  .strict();
export const accountLoginSchema = z
  .object({
    email,
    password: z.string().min(1).max(128),
    otp: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    recoveryCode: z
      .string()
      .regex(/^[a-f0-9]{16}$/)
      .optional(),
  })
  .strict();
export const accountProfileUpdateSchema = z
  .object({
    expectedVersion: version,
    name,
    preferences: accountPreferencesSchema,
    avatarDataUrl: z.string().max(24000).nullable().optional(),
  })
  .strict();
export const accountOrganizationUpdateSchema = z
  .object({ expectedVersion: version, name })
  .strict();
export const accountPasswordUpdateSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: password,
    otp: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    recoveryCode: z
      .string()
      .regex(/^[a-f0-9]{16}$/)
      .optional(),
  })
  .strict();
export const accountInviteSchema = z
  .object({ email, role: accountRoleSchema.exclude(["OWNER"]) })
  .strict();
export const accountAcceptInviteSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const accountMemberUpdateSchema = z
  .object({
    expectedVersion: version,
    role: accountRoleSchema.exclude(["OWNER"]),
    status: accountMemberStatusSchema,
  })
  .strict();
export const accountSwitchSchema = z.object({ organizationId: id }).strict();
export const accountUserSchema = z
  .object({
    id,
    name,
    email,
    emailVerified: z.boolean(),
    mfaEnabled: z.boolean(),
    avatarDataUrl: z.string().max(24000).nullable(),
    version,
    preferences: accountPreferencesSchema,
  })
  .strict();
export const accountOrganizationSchema = z
  .object({ id, name, version, role: accountRoleSchema })
  .strict();
export const accountSessionSchema = z
  .object({
    user: accountUserSchema,
    organization: accountOrganizationSchema,
    organizations: z.array(accountOrganizationSchema).max(200),
    csrfToken: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export const accountMemberSchema = z
  .object({
    id,
    userId: id,
    name,
    email,
    role: accountRoleSchema,
    status: accountMemberStatusSchema,
    version,
  })
  .strict();
export const accountInvitationSchema = z
  .object({
    id,
    email,
    role: accountRoleSchema,
    status: z.enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"]),
    expiresAt: z.iso.datetime(),
  })
  .strict();
export const accountInviteResultSchema = z
  .object({ invitation: accountInvitationSchema, token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const accountAuditSchema = z
  .object({ id, actorName: z.string(), action: z.string(), createdAt: z.iso.datetime() })
  .strict();
export const accountOverviewSchema = z
  .object({
    members: z.array(accountMemberSchema),
    invitations: z.array(accountInvitationSchema),
    audit: z.array(accountAuditSchema).max(50),
    usage: z
      .object({
        activeMembers: z.number().int().nonnegative(),
        pendingInvitations: z.number().int().nonnegative(),
        projects: z.number().int().nonnegative(),
        executions: z.number().int().nonnegative(),
        awaitingApproval: z.number().int().nonnegative(),
        executionSeconds: z.number().int().nonnegative().nullable(),
        executionTimeIncomplete: z.boolean(),
        executionTimeObservedAt: z.iso.datetime(),
        storageBytes: z.number().int().nonnegative(),
        reservedStorageBytes: z.number().int().nonnegative(),
        aiUsage: z
          .object({
            inputTokens: z.number().int().nonnegative().nullable(),
            outputTokens: z.number().int().nonnegative().nullable(),
            observedAt: z.iso.datetime(),
            source: z.literal("persisted-attempt-results"),
            incomplete: z.boolean(),
            byProvider: z
              .array(
                z.object({
                  provider: z.string(),
                  inputTokens: z.number().int().nonnegative().nullable(),
                  outputTokens: z.number().int().nonnegative().nullable(),
                  observations: z.number().int().nonnegative(),
                  incomplete: z.boolean(),
                }),
              )
              .max(10),
          })
          .nullable(),
      })
      .strict(),
    plan: z
      .object({
        status: z.string(),
        name: z.string().nullable(),
        renewsAt: z.iso.datetime().nullable(),
      })
      .strict(),
  })
  .strict();
export const accountSessionsSchema = z
  .array(
    z
      .object({
        id,
        createdAt: z.iso.datetime(),
        expiresAt: z.iso.datetime(),
        current: z.boolean(),
      })
      .strict(),
  )
  .max(20);
export type AccountSession = z.infer<typeof accountSessionSchema>;
export type AccountOverview = z.infer<typeof accountOverviewSchema>;
export type AccountRole = z.infer<typeof accountRoleSchema>;
export type AccountRegister = z.infer<typeof accountRegisterSchema>;
export type AccountLogin = z.infer<typeof accountLoginSchema>;
export type AccountProfileUpdate = z.infer<typeof accountProfileUpdateSchema>;
export type AccountMemberUpdate = z.infer<typeof accountMemberUpdateSchema>;
export type AccountInvite = z.infer<typeof accountInviteSchema>;
export type AccountSessions = z.infer<typeof accountSessionsSchema>;

export const accountMfaInputSchema = z
  .object({
    otp: z
      .string()
      .regex(/^\d{6}$/)
      .optional(),
    recoveryCode: z
      .string()
      .regex(/^[a-f0-9]{16}$/)
      .optional(),
  })
  .strict();
export const accountSensitiveSchema = z
  .object({ password: z.string().min(1).max(128), ...accountMfaInputSchema.shape })
  .strict();
export const accountTokenInputSchema = z
  .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
export const accountResetSchema = z
  .object({
    token: z.string().regex(/^[a-f0-9]{64}$/),
    password: z.string().min(12).max(128),
    ...accountMfaInputSchema.shape,
  })
  .strict();
export const accountRecoverSchema = z
  .object({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()) })
  .strict();
export const accountChangeEmailSchema = accountSensitiveSchema
  .extend({ email: z.string().trim().toLowerCase().max(254).pipe(z.email()) })
  .strict();
export const accountMfaConfirmSchema = z.object({ otp: z.string().regex(/^\d{6}$/) }).strict();
export const accountBillingDetailsSchema = z
  .object({
    legalName: z.string().trim().max(200),
    taxId: z.string().trim().max(100),
    address: z.string().trim().max(500),
    country: z.string().regex(/^[A-Z]{2}$/),
    billingEmail: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  })
  .strict();
export const accountDataSettingsSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    retentionDays: z.number().int().min(7).max(3650),
    billing: accountBillingDetailsSchema,
  })
  .strict();
export const accountTransferSchema = accountSensitiveSchema
  .extend({ membershipId: z.uuid() })
  .strict();
export const accountGrantSchema = z
  .object({ membershipId: z.uuid(), role: accountRoleSchema.exclude(["OWNER", "ADMIN"]) })
  .strict();
export const accountIntegrationInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    provider: z.enum(["CODEX", "CLAUDE", "ANTIGRAVITY", "GITHUB"]),
    mode: z.enum(["SUBSCRIPTION_CLI", "API_KEY", "GITHUB_TOKEN"]),
    secret: z.string().trim().min(1).max(4096).optional(),
    models: z.array(z.string().trim().min(1).max(120)).max(50),
    subscriptionLabel: z.string().trim().max(100),
    fixedCostMinor: z.number().int().nonnegative().max(1_000_000_000).nullable(),
    currency: z.enum(["EUR", "BRL", "USD", "GBP"]),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.provider === "GITHUB") !== (value.mode === "GITHUB_TOKEN"))
      ctx.addIssue({ code: "custom", message: "GitHub uses its dedicated token mode" });
    if (value.provider === "ANTIGRAVITY" && value.mode !== "SUBSCRIPTION_CLI")
      ctx.addIssue({ code: "custom", message: "CLI only" });
    if (value.mode !== "SUBSCRIPTION_CLI" && !value.secret)
      ctx.addIssue({ code: "custom", message: "Credential required" });
    if (value.mode === "SUBSCRIPTION_CLI" && value.secret)
      ctx.addIssue({ code: "custom", message: "Use official CLI onboarding" });
  });
export const accountPlanSelectionSchema = z
  .object({ planId: z.string().regex(/^[a-z0-9-]{1,64}$/), requestId: z.uuid() })
  .strict();
export const accountPlanCatalogSchema = z
  .array(
    z
      .object({
        id: z.string().regex(/^[a-z0-9-]{1,64}$/),
        name: z.string().min(1).max(100),
        version: z.number().int().positive(),
        priceMinor: z.number().int().nonnegative().max(1_000_000_000),
        currency: z.enum(["EUR", "BRL", "USD", "GBP"]),
        interval: z.enum(["month", "year"]),
        stripePriceId: z
          .string()
          .regex(/^price_[a-zA-Z0-9]+$/)
          .nullable(),
        members: z.number().int().min(1).max(200),
        projects: z.number().int().min(1).max(1000),
        storageBytes: z.number().int().min(1).max(1_099_511_627_776),
      })
      .strict(),
  )
  .max(50);
export type AccountIntegrationInput = z.infer<typeof accountIntegrationInputSchema>;
export type AccountPlan = z.infer<typeof accountPlanCatalogSchema>[number];

export const accountBillingStateSchema = z.object({
  catalog: z.array(accountPlanCatalogSchema.element.omit({ stripePriceId: true })),
  configured: z.boolean(),
  selected: z.string().nullable(),
  status: z.string(),
  plan: accountPlanCatalogSchema.element.nullable(),
  cancelAtPeriodEnd: z.boolean(),
  currentPeriodEnd: z.iso.datetime().nullable(),
  billing: accountBillingDetailsSchema.or(z.object({}).strict()),
  retentionDays: z.number().int(),
  version: z.number().int(),
  invoices: z.array(
    z.object({
      id: z.string(),
      amountMinor: z.number(),
      currency: z.string(),
      status: z.string(),
      url: z.url().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ),
});
export const accountNotificationListSchema = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    body: z.string(),
    kind: z.string(),
    readAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  }),
);
export const accountIntegrationListSchema = z.array(
  z.object({
    id: z.uuid(),
    name: z.string(),
    provider: z.string(),
    mode: z.string(),
    runtimeId: z.string().nullable(),
    configuration: z.object(accountIntegrationInputSchema.shape).omit({ secret: true }),
    enabled: z.boolean(),
    version: z.number().int(),
    credentialConfigured: z.boolean(),
    state: z.string(),
    grants: z.array(z.object({ projectId: z.uuid() })),
  }),
);
export type AccountBillingState = z.infer<typeof accountBillingStateSchema>;
export type AccountIntegrationList = z.infer<typeof accountIntegrationListSchema>;
export const accountRepositoryCredentialSchema = z
  .object({ scoped: z.boolean(), token: z.string().min(1).max(4096).nullable() })
  .strict();
export const accountCreateProjectSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    repoUrl: z.url().refine((value) => {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        u.hostname === "github.com" &&
        !u.username &&
        !u.password &&
        !u.search &&
        !u.hash &&
        !u.port &&
        /^\/[a-zA-Z0-9-]{1,39}\/[a-zA-Z0-9_.-]{1,100}\/?$/.test(u.pathname) &&
        !u.pathname.split("/").some((p) => p === "." || p === "..")
      );
    }, "Use an HTTPS github.com repository without credentials"),
    baseRef: z.string().regex(/^[a-f0-9]{40}$/),
  })
  .strict();
