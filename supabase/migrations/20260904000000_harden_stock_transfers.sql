-- Keep stock transfers safe when called directly through the database API.
-- The UI filters these records, but authorization belongs at the database boundary.

CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_from_branch UUID,
  p_to_branch UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  from_qty NUMERIC(12,2);
  from_cost NUMERIC(12,2);
  to_qty NUMERIC(12,2);
  to_cost NUMERIC(12,2);
  new_to_qty NUMERIC(12,2);
  new_to_cost NUMERIC(12,2);
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to transfer stock' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = current_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Only the business owner may transfer stock' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be greater than zero' USING ERRCODE = 'check_violation';
  END IF;
  IF p_from_branch = p_to_branch THEN
    RAISE EXCEPTION 'Sending and receiving branches must be different' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_from_branch AND status = TRUE)
     OR NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_to_branch AND status = TRUE) THEN
    RAISE EXCEPTION 'Both branches must be active' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND status = TRUE) THEN
    RAISE EXCEPTION 'Product is inactive or unavailable' USING ERRCODE = 'check_violation';
  END IF;

  SELECT quantity, avg_cost INTO from_qty, from_cost
  FROM public.inventory
  WHERE branch_id = p_from_branch AND product_id = p_product_id
  FOR UPDATE;
  IF from_qty IS NULL OR from_qty < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock at the sending branch' USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.inventory SET quantity = quantity - p_quantity, updated_at = now()
  WHERE branch_id = p_from_branch AND product_id = p_product_id;

  SELECT quantity, avg_cost INTO to_qty, to_cost
  FROM public.inventory
  WHERE branch_id = p_to_branch AND product_id = p_product_id
  FOR UPDATE;
  IF to_qty IS NULL THEN
    INSERT INTO public.inventory(branch_id, product_id, quantity, avg_cost, updated_at)
    VALUES (p_to_branch, p_product_id, p_quantity, from_cost, now());
  ELSE
    new_to_qty := to_qty + p_quantity;
    new_to_cost := CASE WHEN new_to_qty > 0
      THEN ((to_qty * to_cost) + (p_quantity * from_cost)) / new_to_qty
      ELSE from_cost
    END;
    UPDATE public.inventory SET quantity = new_to_qty, avg_cost = new_to_cost, updated_at = now()
    WHERE branch_id = p_to_branch AND product_id = p_product_id;
  END IF;

  INSERT INTO public.inventory_movements(branch_id, product_id, type, quantity, ref_type, ref_id)
  VALUES (p_from_branch, p_product_id, 'out', p_quantity, 'transfer', NULL);
  INSERT INTO public.inventory_movements(branch_id, product_id, type, quantity, ref_type, ref_id)
  VALUES (p_to_branch, p_product_id, 'in', p_quantity, 'transfer', NULL);
  INSERT INTO public.audit_log(user_id, action, entity, entity_id, branch_id, details)
  VALUES (current_user_id, 'transfer_stock', 'inventory', p_product_id, p_from_branch,
    jsonb_build_object('to_branch', p_to_branch, 'quantity', p_quantity, 'reason', p_reason));
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock(UUID, UUID, UUID, NUMERIC, TEXT) TO authenticated;