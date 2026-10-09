CREATE TABLE "account_users" (
 "id" UUID PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE,
 "password_hash" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
 "preferences" JSONB NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "account_organizations" (
 "id" UUID PRIMARY KEY, "name" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "account_memberships" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL REFERENCES "account_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "user_id" UUID NOT NULL REFERENCES "account_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "role" TEXT NOT NULL CHECK (role IN ('OWNER','ADMIN','OPERATOR','APPROVER','READER')),
 "status" TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','SUSPENDED','REMOVED')),
 "version" INTEGER NOT NULL DEFAULT 1 CHECK (version > 0), UNIQUE ("organization_id", "user_id")
);
CREATE INDEX "account_memberships_user_id_status_idx" ON "account_memberships"("user_id", "status");
CREATE TABLE "account_sessions" (
 "id" UUID PRIMARY KEY, "user_id" UUID NOT NULL REFERENCES "account_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "organization_id" UUID NOT NULL REFERENCES "account_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "token_hash" TEXT NOT NULL UNIQUE, "csrf_token" TEXT NOT NULL,
 "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expires_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "account_sessions_user_id_expires_at_idx" ON "account_sessions"("user_id", "expires_at");
CREATE TABLE "account_invitations" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL REFERENCES "account_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "email" TEXT NOT NULL, "role" TEXT NOT NULL CHECK (role IN ('ADMIN','OPERATOR','APPROVER','READER')),
 "token_hash" TEXT NOT NULL UNIQUE, "status" TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACCEPTED','REVOKED','EXPIRED')),
 "expires_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "account_invitations_organization_id_status_idx" ON "account_invitations"("organization_id", "status");
CREATE UNIQUE INDEX "account_invitations_one_pending" ON "account_invitations"("organization_id", "email") WHERE "status" = 'PENDING';
CREATE TABLE "account_audit_events" (
 "id" UUID PRIMARY KEY, "organization_id" UUID NOT NULL REFERENCES "account_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "actor_id" UUID NOT NULL REFERENCES "account_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "action" TEXT NOT NULL, "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "account_audit_events_organization_id_created_at_idx" ON "account_audit_events"("organization_id", "created_at");
