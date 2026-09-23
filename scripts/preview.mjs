import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { Readable } from "node:stream";

// Preview the actual Vercel output; TanStack's default preview expects dist/server.
process.env.NODE_ENV = "production";
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const entry = await import(
  pathToFileURL(resolve(".vercel/output/functions/__server.func/index.mjs")).href
);
const root = resolve(".vercel/output/static");
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const host = option("--host", "127.0.0.1");
const port = Number(option("--port", "4173"));
const types = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".html": "text/html",
};
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${host}:${port}`);
    const file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
    if (
      (file === root || file.startsWith(root + sep)) &&
      (await stat(file).catch(() => null))?.isFile()
    ) {
      res.setHeader("Content-Type", types[extname(file)] ?? "application/octet-stream");
      res.end(req.method === "HEAD" ? undefined : await readFile(file));
      return;
    }
    const request = new Request(url, {
      method: req.method,
      headers: req.headers,
      ...(!["GET", "HEAD"].includes(req.method)
        ? { body: Readable.toWeb(req), duplex: "half" }
        : {}),
    });
    const response = await entry.default.fetch(request, {
      waitUntil: (promise) => promise.catch(console.error),
    });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body && req.method !== "HEAD") Readable.fromWeb(response.body).pipe(res);
    else res.end();
  } catch (error) {
    console.error(error);
    res.writeHead(500).end("Preview server error");
  }
}).listen(port, host, () => console.log(`Production preview: http://${host}:${port}`));
