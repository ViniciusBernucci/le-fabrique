CREATE TABLE factory_operations (
  id TEXT PRIMARY KEY CHECK(id='factory'),
  paused BOOLEAN NOT NULL DEFAULT true,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- New installations require explicit administrative release; never start agents by migration.
INSERT INTO factory_operations(id,paused,version) VALUES('factory',true,1);
