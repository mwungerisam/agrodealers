-- Store the business identity collected during owner signup.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS business_name TEXT;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_exists BOOLEAN;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('ufbc:first-owner', 0));

  INSERT INTO public.profiles(id, full_name, phone, business_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'phone',
    NULLIF(trim(NEW.raw_user_meta_data->>'business_name'), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = CASE
      WHEN EXCLUDED.full_name <> '' THEN EXCLUDED.full_name
      ELSE public.profiles.full_name
    END,
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    business_name = COALESCE(EXCLUDED.business_name, public.profiles.business_name);

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE role = 'owner'
  ) INTO owner_exists;

  INSERT INTO public.user_roles(user_id, role, is_primary_owner)
  VALUES (
    NEW.id,
    CASE WHEN owner_exists THEN 'manager'::public.app_role ELSE 'owner'::public.app_role END,
    NOT owner_exists
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;