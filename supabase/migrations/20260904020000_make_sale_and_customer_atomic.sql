-- Keep customer creation and sale posting in one database transaction.
-- The sales triggers remain the authoritative source for stock, price, cost,
-- profit, movement, and audit behavior.

CREATE OR REPLACE FUNCTION public.find_or_create_customer(
  p_branch_id UUID,
  p_customer_name TEXT,
  p_customer_phone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  customer_id UUID;
  clean_name TEXT := NULLIF(trim(p_customer_name), '');
  clean_phone TEXT := NULLIF(trim(p_customer_phone), '');
BEGIN
  IF clean_name IS NULL THEN
    RAISE EXCEPTION 'Customer name is required' USING ERRCODE = 'check_violation';
  END IF;

  SELECT c.id INTO customer_id
  FROM public.customers AS c
  WHERE c.branch_id = p_branch_id
    AND lower(trim(c.name)) = lower(clean_name)
    AND c.phone IS NOT DISTINCT FROM clean_phone
  ORDER BY c.created_at, c.id
  LIMIT 1;

  IF customer_id IS NOT NULL THEN
    RETURN customer_id;
  END IF;

  INSERT INTO public.customers (branch_id, name, phone, created_by)
  VALUES (p_branch_id, clean_name, clean_phone, auth.uid())
  RETURNING id INTO customer_id;

  RETURN customer_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_or_create_customer(UUID, TEXT, TEXT)
TO authenticated;

CREATE OR REPLACE FUNCTION public.create_sale(
  p_branch_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_selling_price NUMERIC,
  p_sale_date DATE,
  p_customer_name TEXT,
  p_customer_phone TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  customer_id UUID;
  sale_id UUID;
  clean_name TEXT := NULLIF(trim(p_customer_name), '');
  clean_phone TEXT := NULLIF(trim(p_customer_phone), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to create a sale'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  IF clean_name IS NULL THEN
    RAISE EXCEPTION 'Customer name is required' USING ERRCODE = 'check_violation';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Sale quantity must be greater than zero' USING ERRCODE = 'check_violation';
  END IF;
  IF p_sale_date IS NULL THEN
    RAISE EXCEPTION 'Sale date is required' USING ERRCODE = 'not_null_violation';
  END IF;

  customer_id := public.find_or_create_customer(p_branch_id, clean_name, clean_phone);

  INSERT INTO public.sales (
    branch_id,
    product_id,
    quantity,
    selling_price,
    sale_date,
    customer_id,
    customer_name,
    customer_phone
  )
  VALUES (
    p_branch_id,
    p_product_id,
    p_quantity,
    p_selling_price,
    p_sale_date,
    customer_id,
    clean_name,
    clean_phone
  )
  RETURNING id INTO sale_id;

  RETURN sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_sale(UUID, UUID, NUMERIC, NUMERIC, DATE, TEXT, TEXT)
TO authenticated;

-- Make the new RPC visible to PostgREST immediately after migration.
NOTIFY pgrst, 'reload schema';