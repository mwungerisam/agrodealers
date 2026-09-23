-- Read-only post-deployment checks; no business records or credentials returned.
WITH migrations AS (
SELECT version FROM supabase_migrations.schema_migrations ORDER BY version
), tables AS (

SELECT c.relname AS relation, c.relrowsecurity AS rls_enabled
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relname
), worker_columns AS (

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'worker_products'
ORDER BY ordinal_position
), functions AS (

SELECT p.proname AS function_name, p.prosecdef AS security_definer,
  CASE p.proname
    WHEN 'handle_new_user' THEN position('business_name' in pg_get_functiondef(p.oid)) > 0
    WHEN 'enforce_record_creator' THEN position('auth.users' in pg_get_functiondef(p.oid)) > 0
    WHEN 'log_audit' THEN position('NOT EXISTS' in pg_get_functiondef(p.oid)) > 0
  END AS expected_fix_present,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anonymous_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('handle_new_user', 'enforce_record_creator', 'log_audit',
                   'create_sale', 'transfer_stock', 'adjust_stock', 'delete_worker')
ORDER BY p.proname
)
SELECT
  (SELECT json_agg(migrations) FROM migrations) AS migrations,
  (SELECT json_agg(tables) FROM tables) AS tables,
  (SELECT json_agg(worker_columns) FROM worker_columns) AS worker_columns,
  (SELECT json_agg(functions) FROM functions) AS functions;
