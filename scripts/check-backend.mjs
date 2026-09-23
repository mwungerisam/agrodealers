import { loadEnv } from "vite";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Read-only schema probes: limit=0 prevents fetching business records.
const env = { ...loadEnv("development", process.cwd(), ""), ...process.env };
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  throw new Error("Configure .env and run npm run check:env first.");
}
const source = ts.createSourceFile(
  "types.ts",
  await readFile(new URL("../src/integrations/supabase/types.ts", import.meta.url), "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const database = source.statements.find(
  (node) => ts.isTypeAliasDeclaration(node) && node.name.text === "Database",
).type;
const member = (node, name) =>
  node.members.find((item) => item.name?.getText(source).replaceAll('"', "") === name)?.type;
const schema = member(database, "public");
let failed = false;
for (const relation of [...member(schema, "Tables").members, ...member(schema, "Views").members]) {
  const name = relation.name.getText(source).replaceAll('"', "");
  const columns = member(relation.type, "Row").members.map((column) =>
    column.name.getText(source).replaceAll('"', ""),
  );
  const url = new URL(`/rest/v1/${name}`, env.VITE_SUPABASE_URL);
  url.searchParams.set("select", columns.join(","));
  url.searchParams.set("limit", "0");
  try {
    const response = await fetch(url, {
      headers: { apikey: env.VITE_SUPABASE_PUBLISHABLE_KEY },
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) console.log(`PASS: ${name} columns are available.`);
    else {
      const error = await response.json().catch(() => ({}));
      if (error.code === "42501")
        console.log(`PROTECTED: ${name}; signed-in access is required to verify its columns.`);
      else {
        failed = true;
        console.error(`FAIL: ${name}: HTTP ${response.status}, ${error.code ?? "unavailable"}`);
      }
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL: ${name}: ${error.cause?.code ?? error.code ?? "connection failed"}`);
  }
}
console.log(
  "These probes do not verify RLS behavior, RPC bodies or migration history. Use the database regression tests and Supabase migration list for those checks.",
);
process.exitCode = failed ? 1 : 0;
