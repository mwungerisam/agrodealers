import { loadEnv } from "vite";

const env = loadEnv("production", process.cwd(), "");
const base = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
if (!base) throw new Error("Configure the Supabase URL before checking the function.");
const url = `${base.replace(/\/$/, "")}/functions/v1/create-worker`;
const origin = process.argv[2] || "https://ufbcagrodealer-peach.vercel.app";
const preflight = await fetch(url, {
  method: "OPTIONS",
  headers: { Origin: origin, "Access-Control-Request-Method": "POST" },
  signal: AbortSignal.timeout(30000),
});
if (preflight.status !== 200 || preflight.headers.get("access-control-allow-origin") !== origin) {
  throw new Error(`Function preflight failed (HTTP ${preflight.status}).`);
}
const denied = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: "{}",
  signal: AbortSignal.timeout(30000),
});
if (denied.status !== 401) throw new Error(`Expected unauthorized response, got ${denied.status}.`);
console.log(
  "PASS: worker function accepts application preflight and rejects unauthenticated creation.",
);
