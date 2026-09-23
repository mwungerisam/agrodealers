-- Match the existing sales/purchases history protection for inventory records.
-- Linked products can be deactivated with products.status instead of deleting
-- their stock or movement history. Unused products can still be deleted.
BEGIN;
ALTER TABLE public.inventory
  DROP CONSTRAINT inventory_product_id_fkey,
  ADD CONSTRAINT inventory_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
ALTER TABLE public.inventory_movements
  DROP CONSTRAINT inventory_movements_product_id_fkey,
  ADD CONSTRAINT inventory_movements_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
COMMIT;
