CREATE TABLE "provider_api_credentials" (
  "installation_id" TEXT PRIMARY KEY,
  "provider" TEXT NOT NULL,
  "encrypted_key" TEXT NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL
);
