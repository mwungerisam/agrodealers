# Business history and annual reports

Business records in Supabase do not expire when the browser closes, a month ends,
or a new year begins. This application has no scheduled age-based purge and does
not delete records after 365 days. Keep records for at least a full year; older
years remain available too. No retention cutoff has been introduced.

Owners can open **Reports → Annual**, enter the calendar year, choose all branches
or a single branch, and download the PDF. Annual reports cover January 1 through
December 31. The report reads every result page rather than stopping at the
database API's per-request row limit.

Six date/branch indexes support these historical queries without changing data,
calculations, permissions, or the interface. The isolated database regression test
verifies a previous year's 1,205 sales, all twelve months of expenses, purchases,
and complete paginated retrieval.

Existing protections remain: ordinary authenticated users cannot modify or delete
sales and purchases; linked products cannot delete their stock or transaction
history. Deactivate linked products instead. Existing explicit owner deletion
permissions for other record types remain unchanged, so this is not a tamper-proof
archive or a guarantee against administrator deletion.

Retention of live records is separate from disaster recovery. Confirm the hosted
project's backup retention and restore process before relying on backups. This
change does not configure backups, increase storage quotas, or change the hosting
plan. Monitor storage usage as transaction volume grows.
