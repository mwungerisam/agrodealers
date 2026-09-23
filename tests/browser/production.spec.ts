import { test, expect } from "@playwright/test";

test("production login hydrates under a fresh per-request CSP nonce", async ({ page, request }) => {
  const errors: string[] = [];
  const externalFontRequests: string[] = [];
  page.on("request", (request) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(request.url()))
      externalFontRequests.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    (window as unknown as { cspErrors: string[] }).cspErrors = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      (window as unknown as { cspErrors: string[] }).cspErrors.push(event.violatedDirective);
    });
  });
  const response = await page.goto("/auth");
  expect(response?.status()).toBe(200);
  const csp = response?.headers()["content-security-policy"] ?? "";
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1];
  expect(nonce).toBeTruthy();
  // Hydration removes its bootstrap scripts, so inspect the original response.
  const html = await response!.text();
  const scriptNonces = [...html.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script>/g)]
    .filter((match) => !/\bsrc=/.test(match[1]))
    .map((match) => match[1].match(/\bnonce="([^"]+)"/)?.[1]);
  expect(scriptNonces.length).toBeGreaterThan(0);
  expect(scriptNonces.every((value) => value === nonce)).toBe(true);
  await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByRole("button", { name: "Hide password" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('400 16px "Inter Variable"'))).toBe(true);
  expect(externalFontRequests).toEqual([]);
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(() => (window as unknown as { cspErrors: string[] }).cspErrors),
  ).toEqual([]);
  const next = await request.get("/auth", { headers: { "x-ufbc-nonce": "caller-controlled" } });
  const nextCsp = next.headers()["content-security-policy"];
  expect(nextCsp).not.toContain(nonce!);
  expect(nextCsp).not.toContain("caller-controlled");
});
