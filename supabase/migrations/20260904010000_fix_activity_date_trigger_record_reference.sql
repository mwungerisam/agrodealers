-- Fix the shared activity-date trigger function so it never resolves a date
-- field from a different table's NEW record.

CREATE OR REPLACE FUNCTION public.enforce_worker_activity_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  activity_date DATE;
  business_date DATE;
BEGIN
  business_date := (timezone('Africa/Kigali', now()))::date;

  IF TG_TABLE_NAME = 'sales' THEN
    activity_date := NEW.sale_date;
  ELSIF TG_TABLE_NAME = 'purchases' THEN
    activity_date := NEW.purchase_date;
  ELSIF TG_TABLE_NAME = 'expenses' THEN
    activity_date := NEW.expense_date;
  ELSE
    RAISE EXCEPTION 'Unsupported activity date table: %', TG_TABLE_NAME
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT public.has_role(auth.uid(), 'owner')
     AND activity_date <> business_date THEN
    RAISE EXCEPTION 'Workers may only record activity for the current date'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sales_activity_date ON public.sales;
CREATE TRIGGER trg_sales_activity_date
BEFORE INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_activity_date();

DROP TRIGGER IF EXISTS trg_purchases_activity_date ON public.purchases;
CREATE TRIGGER trg_purchases_activity_date
BEFORE INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_activity_date();

DROP TRIGGER IF EXISTS trg_expenses_activity_date ON public.expenses;
CREATE TRIGGER trg_expenses_activity_date
BEFORE INSERT ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.enforce_worker_activity_date();