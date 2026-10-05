CREATE TABLE "project_definitions" (
  "project_id" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "configuration" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_definitions_pkey" PRIMARY KEY ("project_id")
);

ALTER TABLE "project_definitions"
  ADD CONSTRAINT "project_definitions_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
