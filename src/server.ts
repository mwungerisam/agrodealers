import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (
    request: Request,
    options?: { context?: { nonce?: string } },
  ) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

function withSecurityHeaders(response: Response, request: Request, nonce: string): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");

  if (request.url.startsWith("https://")) {
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  if (
    process.env.NODE_ENV === "production" &&
    response.headers.get("content-type")?.includes("text/html")
  ) {
    const supabaseOrigin = getSupabaseOrigin();
    headers.set(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        "base-uri 'self'",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        `script-src 'self' 'nonce-${nonce}'`,
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        `connect-src 'self' ${supabaseOrigin} wss://*.supabase.co`,
      ].join("; "),
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function getSupabaseOrigin(): string {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) return "https://*.supabase.co";

  try {
    return new URL(supabaseUrl).origin;
  } catch {
    return "https://*.supabase.co";
  }
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const nonce = crypto.randomUUID().replaceAll("-", "");
    const requestHeaders = new Headers(request.headers);
    // Always replace a caller-supplied nonce. Router SSR uses this value on the
    // hydration scripts, and the response CSP permits only this request's value.
    requestHeaders.set("x-ufbc-nonce", nonce);
    // The development adapter uses a Request proxy; constructing from its URL
    // avoids depending on native Request internal slots that the proxy lacks.
    const requestInit: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers: requestHeaders,
      signal: request.signal,
    };
    if (request.method !== "GET" && request.method !== "HEAD") {
      requestInit.body = request.body;
      requestInit.duplex = "half";
    }
    const securedRequest = new Request(request.url, requestInit);
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(securedRequest, { context: { nonce } });
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), request, nonce);
    } catch (error) {
      console.error(error);
      return withSecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        request,
        nonce,
      );
    }
  },
};
