-- Records have no expiry. Keep prior years available and make both whole-
-- business and per-branch date-range reports efficient as history grows.
-- No data is removed or rewritten, and existing permissions stay unchanged.
CREATE INDEX IF NOT EXISTS sales_report_date_id_idx
  ON public.sales (sale_date DESC, id);
CREATE INDEX IF NOT EXISTS sales_report_branch_date_id_idx
  ON public.sales (branch_id, sale_date DESC, id);
CREATE INDEX IF NOT EXISTS purchases_report_date_id_idx
  ON public.purchases (purchase_date DESC, id);
CREATE INDEX IF NOT EXISTS purchases_report_branch_date_id_idx
  ON public.purchases (branch_id, purchase_date DESC, id);
CREATE INDEX IF NOT EXISTS expenses_report_date_id_idx
  ON public.expenses (expense_date DESC, id);
CREATE INDEX IF NOT EXISTS expenses_report_branch_date_id_idx
  ON public.expenses (branch_id, expense_date DESC, id);
