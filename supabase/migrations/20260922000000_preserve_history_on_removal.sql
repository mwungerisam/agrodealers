-- Keep immutable authors on ordinary edits, while allowing the existing
-- ON DELETE SET NULL foreign keys to retain history when a worker is removed.
CREATE OR REPLACE FUNCTION public.enforce_record_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND auth.uid() IS NOT NULL THEN
    NEW.created_by := auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.created_by IS NULL AND OLD.created_by IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM auth.users WHERE id = OLD.created_by) THEN
      NEW.created_by := NULL;
    ELSE
      NEW.created_by := OLD.created_by;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- A deleted branch cannot remain the FK target of its own deletion audit.
-- Preserve its identity in entity_id/details and leave the optional FK empty.
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snapshot JSONB;
  ent_id UUID;
  br_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    snapshot := to_jsonb(OLD);
  ELSE
    snapshot := to_jsonb(NEW);
  END IF;
  ent_id := (snapshot->>'id')::UUID;
  br_id := CASE WHEN TG_TABLE_NAME = 'branches' THEN ent_id
                ELSE (snapshot->>'branch_id')::UUID END;
  IF br_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.branches WHERE id = br_id) THEN
    br_id := NULL;
  END IF;
  INSERT INTO public.audit_log(user_id, action, entity, entity_id, branch_id, details)
  VALUES (auth.uid(), lower(TG_OP), TG_TABLE_NAME, ent_id, br_id, snapshot);
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_record_creator() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.log_audit() FROM PUBLIC, anon, authenticated;
