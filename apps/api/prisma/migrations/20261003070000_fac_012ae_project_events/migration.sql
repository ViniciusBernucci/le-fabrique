CREATE TABLE project_event_cursors (
  project_id UUID PRIMARY KEY REFERENCES projects(id) ON DELETE RESTRICT,
  sequence BIGINT NOT NULL DEFAULT 0 CHECK (sequence >= 0)
);
CREATE TABLE project_events (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  sequence BIGINT NOT NULL CHECK (sequence > 0),
  kind TEXT NOT NULL CHECK (kind IN ('TICKET_CHANGED','RUN_CHANGED','ATTEMPT_CHANGED','CHECKPOINT_CHANGED')),
  entity_id UUID NOT NULL,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(project_id, sequence)
);

-- The per-project row lock remains held until commit. An allocated sequence cannot
-- commit after a later sequence for the same project, unlike BIGSERIAL/nextval.
CREATE FUNCTION append_project_event(p_project UUID, p_kind TEXT, p_entity UUID)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE next_sequence BIGINT;
BEGIN
  INSERT INTO project_event_cursors(project_id,sequence) VALUES(p_project,1)
    ON CONFLICT(project_id) DO UPDATE SET sequence=project_event_cursors.sequence+1
    RETURNING sequence INTO next_sequence;
  INSERT INTO project_events(project_id,sequence,kind,entity_id,created_at)
    VALUES(p_project,next_sequence,p_kind,p_entity,clock_timestamp());
END;
$$;

CREATE FUNCTION ticket_project_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.status,NEW.version,NEW.title,NEW.objective,NEW.acceptance_criteria)
    IS NOT DISTINCT FROM ROW(OLD.status,OLD.version,OLD.title,OLD.objective,OLD.acceptance_criteria) THEN RETURN NEW; END IF;
  PERFORM append_project_event(NEW.project_id,'TICKET_CHANGED',NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER ticket_project_event AFTER INSERT OR UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION ticket_project_event();

CREATE FUNCTION run_project_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE project UUID;
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.status,NEW.version,NEW.control_action,NEW.approval)
    IS NOT DISTINCT FROM ROW(OLD.status,OLD.version,OLD.control_action,OLD.approval) THEN RETURN NEW; END IF;
  SELECT project_id INTO STRICT project FROM tickets WHERE id=NEW.ticket_id;
  PERFORM append_project_event(project,'RUN_CHANGED',NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER run_project_event AFTER INSERT OR UPDATE ON runs
  FOR EACH ROW EXECUTE FUNCTION run_project_event();

CREATE FUNCTION attempt_project_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE project UUID;
BEGIN
  IF TG_OP='UPDATE' AND ROW(NEW.status,NEW.stopped_confirmed,NEW.result_digest,NEW.artifact_digest)
    IS NOT DISTINCT FROM ROW(OLD.status,OLD.stopped_confirmed,OLD.result_digest,OLD.artifact_digest) THEN RETURN NEW; END IF;
  SELECT t.project_id INTO STRICT project FROM runs r JOIN tickets t ON t.id=r.ticket_id WHERE r.id=NEW.run_id;
  PERFORM append_project_event(project,'ATTEMPT_CHANGED',NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER attempt_project_event AFTER INSERT OR UPDATE ON attempts
  FOR EACH ROW EXECUTE FUNCTION attempt_project_event();

CREATE FUNCTION checkpoint_project_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE project UUID;
BEGIN
  SELECT t.project_id INTO STRICT project FROM attempts a JOIN runs r ON r.id=a.run_id
    JOIN tickets t ON t.id=r.ticket_id WHERE a.id=NEW.attempt_id;
  PERFORM append_project_event(project,'CHECKPOINT_CHANGED',NEW.id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER checkpoint_project_event AFTER INSERT ON checkpoints
  FOR EACH ROW EXECUTE FUNCTION checkpoint_project_event();
