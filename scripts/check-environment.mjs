import { loadEnv } from "vite";
import { lookup } from "node:dns/promises";

const env = { ...loadEnv("development", process.cwd(), ""), ...process.env };
let failed = false;
const fail = (message) => {
  failed = true;
  console.error(`FAIL: ${message}`);
};
const pairs = [
  ["SUPABASE_URL", "VITE_SUPABASE_URL"],
  ["SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"],
];
for (const [server, browser] of pairs) {
  if (!env[server] || !env[browser]) fail(`Set ${server} and ${browser}.`);
  else if (env[server] !== env[browser]) fail(`${server} and ${browser} do not match.`);
}
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
if (key.startsWith("sb_secret_")) fail("A secret key is configured in a public browser variable.");
else if (key.startsWith("eyJ")) {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString());
    if (payload.role !== "anon") fail("The browser JWT must use the anon role.");
  } catch {
    fail("The public JWT key is malformed.");
  }
} else if (!key.startsWith("sb_publishable_")) fail("Configure a valid public Supabase key.");
for (const name of Object.keys(env)) {
  if (name.startsWith("VITE_") && /SECRET|PASSWORD|SERVICE_ROLE|ACCESS_TOKEN/.test(name))
    fail(`Remove private configuration from ${name}.`);
}
let url;
try {
  url = new URL(env.VITE_SUPABASE_URL);
  if (!/^https?:$/.test(url.protocol)) fail("Supabase URL must use HTTP or HTTPS.");
  const ref = url.hostname.endsWith(".supabase.co") ? url.hostname.split(".")[0] : null;
  for (const name of ["SUPABASE_PROJECT_ID", "VITE_SUPABASE_PROJECT_ID"]) {
    if (ref && env[name] && env[name] !== ref) fail(`${name} differs from the configured URL.`);
  }
} catch {
  fail("Supabase URL is missing or invalid.");
}

if (!failed && process.argv.includes("--remote")) {
  try {
    await lookup(url.hostname);
    const response = await fetch(new URL("/auth/v1/settings", url), {
      headers: { apikey: key },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) fail(`Supabase Auth returned HTTP ${response.status}.`);
    else {
      const settings = await response.json();
      console.log(
        `Supabase reachable; public signup ${settings.disable_signup ? "disabled" : "enabled"}.`,
      );
      if (env.VITE_ENABLE_OWNER_SIGNUP === "true" && settings.disable_signup)
        fail("Owner setup is enabled in the UI but disabled in Supabase Auth.");
    }
  } catch (error) {
    fail(`Supabase connection failed: ${error.cause?.code ?? error.code ?? error.message}`);
  }
}
if (!failed) console.log("Environment checks passed. No credential values were printed.");
process.exitCode = failed ? 1 : 0;
