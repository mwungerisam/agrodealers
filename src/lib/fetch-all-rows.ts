type PagedQuery<T> = {
  range: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: unknown;
  }>;
};

/** Read every page for totals/exports. Callers must provide a stable ordering. */
export async function fetchAllRows<T>(query: PagedQuery<T>): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 500;
  // Continue until an empty response, rather than assuming the server's max
  // rows setting equals our page size. A failed page never yields partial totals.
  for (;;) {
    const { data, error } = await query.range(rows.length, rows.length + pageSize - 1);
    if (error) throw error;
    if (!data?.length) return rows;
    rows.push(...data);
  }
}
