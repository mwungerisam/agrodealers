import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("product removal deletes unused products and preserves linked products through deactivation", async ({
  page,
}) => {
  const ownerId = "10000000-0000-0000-0000-000000000001";
  const products = [
    {
      id: "30000000-0000-0000-0000-000000000001",
      name: "Linked seed",
      category: "imbuto",
      buying_price: 100,
      selling_price: 150,
      unit: "kg",
      min_stock: 0,
      status: true,
    },
    {
      id: "30000000-0000-0000-0000-000000000002",
      name: "Unused seed",
      category: "imbuto",
      buying_price: 100,
      selling_price: 150,
      unit: "kg",
      min_stock: 0,
      status: true,
    },
  ];
  const deleted: string[] = [];
  let roleReads = 0;
  let releaseRole: (() => void) | undefined;
  let holdRoleRefresh = false;
  await page.route("https://*.supabase.co/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").pop();
    const id = url.searchParams.get("id")?.replace("eq.", "");
    const method = route.request().method();
    let data: unknown = [];
    const headers: Record<string, string> = { "access-control-expose-headers": "content-range" };
    if (table === "user_roles") {
      roleReads += 1;
      if (holdRoleRefresh)
        await new Promise<void>((resolve) => {
          releaseRole = resolve;
        });
      data = [{ role: "owner", branch_id: null, is_primary_owner: true }];
    }
    if (table === "products") {
      if (method === "DELETE") {
        deleted.push(id!);
        const index = products.findIndex((product) => product.id === id);
        products.splice(index, 1);
        data = { id };
      } else if (method === "PATCH") {
        expect(route.request().postDataJSON()).toEqual({ status: false });
        products.find((product) => product.id === id)!.status = false;
        data = { id };
      } else data = products;
    }
    if (method === "HEAD")
      headers["content-range"] =
        url.searchParams.get("product_id")?.endsWith("0001") && table === "inventory"
          ? "0-0/1"
          : "*/0";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers,
      body: method === "HEAD" ? "" : JSON.stringify(data),
    });
  });
  await page.addInitScript(
    ({ ownerId }) => {
      localStorage.setItem(
        "sb-apurturkurdeouccjrqo-auth-token",
        JSON.stringify({
          access_token: "test-access-token",
          refresh_token: "test-refresh-token",
          token_type: "bearer",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: ownerId,
            email: "owner@example.test",
            aud: "authenticated",
            role: "authenticated",
            app_metadata: {},
            user_metadata: {},
            created_at: new Date().toISOString(),
          },
        }),
      );
      // CI builds use a placeholder project URL.
      localStorage.setItem(
        "sb-example-auth-token",
        localStorage.getItem("sb-apurturkurdeouccjrqo-auth-token")!,
      );
    },
    { ownerId },
  );
  await page.goto("/products", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Remove Linked seed", exact: true }).click();
  expect(roleReads).toBe(1);
  holdRoleRefresh = true;
  await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
  await expect.poll(() => roleReads).toBe(2);
  // Returning to a tab must not unmount the page or discard an open dialog.
  await expect(page.getByRole("heading", { name: "Delete product?" })).toBeVisible();
  holdRoleRefresh = false;
  releaseRole!();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Product has linked records" })).toBeVisible();
  expect(deleted).toEqual([]);
  await page.getByRole("button", { name: "Deactivate product", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Linked seed" })).toContainText("Inactive");
  await page.getByRole("button", { name: "Remove Unused seed", exact: true }).click();
  await page.getByRole("button", { name: "Delete permanently", exact: true }).click();
  await expect(page.getByRole("row").filter({ hasText: "Unused seed" })).toHaveCount(0);
  expect(deleted).toEqual(["30000000-0000-0000-0000-000000000002"]);
  await page.getByRole("link", { name: "Reports", exact: true }).first().click();
  await page.getByRole("tab", { name: /weekly/i }).click();
  await page.locator('input[type="date"]').fill("");
  await expect(page.getByRole("status")).toContainText("Choose a valid reporting");
  await page.getByRole("tab", { name: /monthly/i }).click();
  await page.locator('input[type="month"]').fill("");
  await expect(page.getByRole("status")).toContainText("Choose a valid reporting");
  await page.locator('input[type="month"]').fill("2026-09");
  await expect(page.getByRole("button", { name: /download/i })).toBeEnabled();
});

test("login renders on desktop and mobile without overflow or runtime errors", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/auth", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Show password" }).click();
    await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`login-${width}.png`), fullPage: true });
  }
  expect(errors).toEqual([]);
});

test("protected routes redirect signed-out users and missing routes show 404", async ({ page }) => {
  await page.goto("/sales", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/auth$/);
  await page.goto("/missing-page", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
});

test("period reports generate a PDF without optional dashboard sections", async ({ page }) => {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.evaluate(async () => {
    // Vite serves the actual PDF module. This uses synthetic rows, not business data.
    const modulePath = "/src/lib/pdf.ts";
    const { generateReportPdf } = await import(/* @vite-ignore */ modulePath);
    await generateReportPdf({
      title: "Regression report",
      period: "2026-09-22",
      branchName: "Test branch",
      sales: Array.from({ length: 100 }, (_, i) => ({
        date: "2026-09-22",
        branch: "Test branch",
        product: "Seed",
        customer: `Customer ${i}`,
        qty: 1,
        price: 150,
        profit: 50,
      })),
      purchases: [],
      expenses: [],
      totals: { sales: 15000, profit: 5000, purchases: 0, expenses: 0, net: 5000, customers: 100 },
    });
  });
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("Regression_report.pdf");
  const path = await download.path();
  expect(path).toBeTruthy();
  const pdf = await readFile(path!);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(5000);
});

test("report pagination includes all rows and rejects partial results", async ({ page }) => {
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  const result = await page.evaluate(async () => {
    const modulePath = "/src/lib/fetch-all-rows.ts";
    const { fetchAllRows } = await import(/* @vite-ignore */ modulePath);
    const source = Array.from({ length: 1203 }, (_, id) => ({ id }));
    const rows = await fetchAllRows({
      range: async (from: number, to: number) => ({
        // Simulate a server cap lower than the helper's requested page size.
        data: source.slice(from, Math.min(to + 1, from + 100)),
        error: null,
      }),
    });
    let failed = false;
    try {
      await fetchAllRows({
        range: async (from: number) =>
          from === 0
            ? { data: source.slice(0, 100), error: null }
            : { data: null, error: new Error("Network unavailable") },
      });
    } catch {
      failed = true;
    }
    return { count: rows.length, last: rows.at(-1).id, failed };
  });
  expect(result).toEqual({ count: 1203, last: 1202, failed: true });
});
