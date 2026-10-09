ALTER TABLE account_users ADD COLUMN email_verified_at TIMESTAMP(3), ADD COLUMN avatar_data_url TEXT,
 ADD COLUMN mfa_secret TEXT, ADD COLUMN mfa_pending_secret TEXT, ADD COLUMN mfa_pending_expires_at TIMESTAMP(3),
 ADD COLUMN mfa_last_step BIGINT, ADD COLUMN recovery_hashes JSONB NOT NULL DEFAULT '[]';
ALTER TABLE account_organizations ADD COLUMN archived_at TIMESTAMP(3), ADD COLUMN retention_days INTEGER NOT NULL DEFAULT 365 CHECK (retention_days BETWEEN 7 AND 3650),
 ADD COLUMN billing JSONB NOT NULL DEFAULT '{}', ADD COLUMN plan_id TEXT, ADD COLUMN stripe_customer_id TEXT UNIQUE,
 ADD COLUMN stripe_subscription_id TEXT UNIQUE, ADD COLUMN subscription_status TEXT NOT NULL DEFAULT 'NONE',
 ADD COLUMN cancel_at_period_end BOOLEAN NOT NULL DEFAULT false, ADD COLUMN current_period_end TIMESTAMP(3);
ALTER TABLE projects ADD COLUMN organization_id UUID REFERENCES account_organizations(id) ON DELETE RESTRICT;
CREATE INDEX projects_organization_id_idx ON projects(organization_id);
ALTER TABLE projects ADD CONSTRAINT projects_org_id_pair UNIQUE(organization_id,id);
ALTER TABLE account_memberships ADD CONSTRAINT account_memberships_org_id_pair UNIQUE(organization_id,id);
CREATE UNIQUE INDEX account_memberships_single_owner ON account_memberships(organization_id) WHERE role='OWNER';
CREATE TABLE account_project_grants (id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES account_organizations(id), project_id UUID NOT NULL,
 membership_id UUID NOT NULL, role TEXT NOT NULL CHECK (role IN ('OPERATOR','APPROVER','READER')),
 FOREIGN KEY(organization_id,project_id) REFERENCES projects(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(organization_id,membership_id) REFERENCES account_memberships(organization_id,id) ON DELETE RESTRICT, UNIQUE(project_id,membership_id));
CREATE INDEX account_project_grants_organization_id_idx ON account_project_grants(organization_id);
CREATE TABLE account_job_authorities(ticket_id UUID PRIMARY KEY REFERENCES tickets(id), organization_id UUID NOT NULL REFERENCES account_organizations(id),
 user_id UUID NOT NULL REFERENCES account_users(id), project_id UUID NOT NULL, revoked BOOLEAN NOT NULL DEFAULT false,
 FOREIGN KEY(organization_id,project_id) REFERENCES projects(organization_id,id));
CREATE TABLE account_integrations(id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES account_organizations(id), name TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN('CODEX','CLAUDE','ANTIGRAVITY','GITHUB')), mode TEXT NOT NULL CHECK(mode IN('SUBSCRIPTION_CLI','API_KEY','GITHUB_TOKEN')),
 runtime_id TEXT UNIQUE, configuration JSONB NOT NULL, secret_encrypted TEXT, enabled BOOLEAN NOT NULL DEFAULT true,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(organization_id,id));
CREATE INDEX account_integrations_organization_id_idx ON account_integrations(organization_id);
CREATE TABLE account_integration_grants(integration_id UUID NOT NULL,project_id UUID NOT NULL,organization_id UUID NOT NULL,
 PRIMARY KEY(integration_id,project_id), FOREIGN KEY(organization_id,integration_id) REFERENCES account_integrations(organization_id,id),
 FOREIGN KEY(organization_id,project_id) REFERENCES projects(organization_id,id));
CREATE TABLE account_security_tokens(id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES account_users(id),kind TEXT NOT NULL,
 subject TEXT NOT NULL,token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMP(3) NOT NULL,used_at TIMESTAMP(3));
CREATE INDEX account_security_tokens_user_id_kind_idx ON account_security_tokens(user_id,kind);
CREATE TABLE account_email_jobs(id UUID PRIMARY KEY,recipient TEXT NOT NULL,subject TEXT NOT NULL,encrypted_body TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING',attempts INTEGER NOT NULL DEFAULT 0,next_attempt_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 claimed_at TIMESTAMP(3),created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX account_email_jobs_status_next_attempt_at_idx ON account_email_jobs(status,next_attempt_at);
CREATE TABLE account_notifications(id UUID PRIMARY KEY,user_id UUID NOT NULL REFERENCES account_users(id),organization_id UUID NOT NULL REFERENCES account_organizations(id),
 project_id UUID REFERENCES projects(id),kind TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,read_at TIMESTAMP(3),created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX account_notifications_user_id_organization_id_created_at_idx ON account_notifications(user_id,organization_id,created_at);
CREATE TABLE account_billing_events(id TEXT PRIMARY KEY,created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE account_invoices(id TEXT PRIMARY KEY,organization_id UUID NOT NULL REFERENCES account_organizations(id),amount_minor BIGINT NOT NULL,currency TEXT NOT NULL,
 status TEXT NOT NULL,hosted_url TEXT,created_at TIMESTAMP(3) NOT NULL);
CREATE INDEX account_invoices_organization_id_created_at_idx ON account_invoices(organization_id,created_at);
CREATE TABLE account_ownership_transfers(id UUID PRIMARY KEY,organization_id UUID NOT NULL REFERENCES account_organizations(id),from_user_id UUID NOT NULL REFERENCES account_users(id),
 to_user_id UUID NOT NULL REFERENCES account_users(id),token_hash TEXT NOT NULL UNIQUE,expires_at TIMESTAMP(3) NOT NULL,accepted_at TIMESTAMP(3));
-- Notifications derive only from persisted ticket state; user preferences and project grants apply.
CREATE FUNCTION account_ticket_notification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE org UUID;
BEGIN
 IF TG_OP='UPDATE' AND NEW.status=OLD.status THEN RETURN NEW; END IF;
 SELECT organization_id INTO org FROM projects WHERE id=NEW.project_id;
 IF org IS NULL THEN RETURN NEW; END IF;
 INSERT INTO account_notifications(id,user_id,organization_id,project_id,kind,title,body)
 SELECT gen_random_uuid(),m.user_id,org,NEW.project_id,CASE WHEN NEW.status::text='VALIDATING' THEN 'DELIVERY' ELSE 'EXECUTION' END,
 CASE WHEN NEW.status::text='VALIDATING' THEN 'Entrega aguardando aceite' ELSE 'Atualização de execução' END,
 left(NEW.title,200)||' · '||NEW.status::text
 FROM account_memberships m JOIN account_users u ON u.id=m.user_id
 WHERE m.organization_id=org AND m.status='ACTIVE'
 AND (m.role IN('OWNER','ADMIN') OR EXISTS(SELECT 1 FROM account_project_grants g WHERE g.membership_id=m.id AND g.project_id=NEW.project_id))
 AND COALESCE((u.preferences->>CASE WHEN NEW.status::text='VALIDATING' THEN 'deliveryNotifications' ELSE 'executionNotifications' END)::boolean,false);
 RETURN NEW;
END $$;
CREATE TRIGGER account_ticket_notifications AFTER UPDATE OF status ON tickets FOR EACH ROW EXECUTE FUNCTION account_ticket_notification();

ALTER TABLE account_organizations ADD COLUMN plan_snapshot JSONB;
CREATE TABLE account_billing_intents(id UUID PRIMARY KEY,organization_id UUID NOT NULL REFERENCES account_organizations(id),plan_snapshot JSONB NOT NULL,
 stripe_session_id TEXT UNIQUE,status TEXT NOT NULL DEFAULT 'REQUESTED',created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX account_billing_intents_organization_id_status_idx ON account_billing_intents(organization_id,status);
CREATE UNIQUE INDEX account_billing_intents_one_pending ON account_billing_intents(organization_id) WHERE status IN('REQUESTED','CHECKOUT');
CREATE TABLE account_project_configurations(project_id UUID PRIMARY KEY,organization_id UUID NOT NULL,configuration JSONB NOT NULL,version INTEGER NOT NULL DEFAULT 1,
 FOREIGN KEY(organization_id,project_id) REFERENCES projects(organization_id,id));
CREATE TABLE account_storage_reservations(attempt_id UUID PRIMARY KEY REFERENCES attempts(id),organization_id UUID NOT NULL REFERENCES account_organizations(id),bytes BIGINT NOT NULL CHECK(bytes>=0));
