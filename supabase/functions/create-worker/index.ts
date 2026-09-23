import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Keep the live application working even before the optional Supabase secret
// has been configured. The secret can add further approved origins, such as a
// local development URL or a custom domain.
const defaultAllowedOrigins = [
  "https://ufbcagrodealer-peach.vercel.app",
  "http://localhost:5173",
  "http://localhost:5174",
];
const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...(Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("Origin");
  if (origin && !allowedOrigins.includes(origin)) return {};
  return {
    ...(origin ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {}),
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function isStrongPassword(value: string): boolean {
  return (
    value.length >= 12 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value)
  );
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.headers.get("Origin") && Object.keys(headers).length === 0) {
    return Response.json({ error: "Origin is not allowed" }, { status: 403 });
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST")
    return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  const authorization = request.headers.get("Authorization");
  if (!authorization) return Response.json({ error: "Unauthorized" }, { status: 401, headers });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const token = authorization.replace("Bearer ", "");
  const {
    data: { user },
  } = await admin.auth.getUser(token);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  const { data: role } = await admin
    .from("user_roles")
    .select("role, is_primary_owner")
    .eq("user_id", user.id)
    .maybeSingle();
  if (role?.role !== "owner" || role.is_primary_owner !== true) {
    return Response.json({ error: "Primary owner access required" }, { status: 403, headers });
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const branchId = typeof body?.branchId === "string" ? body.branchId : "";
  const initialPassword = typeof body?.initialPassword === "string" ? body.initialPassword : "";

  if (!email || !fullName || !branchId || !initialPassword) {
    return Response.json(
      { error: "Name, email, branch, and an initial password are required" },
      { status: 400, headers },
    );
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400, headers });
  }
  if (!isStrongPassword(String(initialPassword))) {
    return Response.json(
      {
        error:
          "The initial password must have 12+ characters with upper- and lower-case letters, a number, and a symbol",
      },
      { status: 400, headers },
    );
  }

  const { data: branch } = await admin
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .eq("status", true)
    .maybeSingle();
  if (!branch) return Response.json({ error: "Choose an active branch" }, { status: 400, headers });

  // Create the account directly rather than sending an invitation email. This
  // keeps worker onboarding available when the provider's email quota is busy.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  });
  if (error || !data.user)
    return Response.json(
      { error: error?.message ?? "Could not create worker" },
      { status: 400, headers },
    );
  const { error: roleError } = await admin
    .from("user_roles")
    .upsert(
      { user_id: data.user.id, role: "manager", branch_id: branchId },
      { onConflict: "user_id" },
    );
  if (roleError) {
    // Do not leave an account that cannot use the application. The owner can
    // safely correct the branch setup and submit the worker again.
    const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
    const errorMessage = deleteError
      ? `${roleError.message} (the account could not be rolled back; contact support before retrying)`
      : roleError.message;
    return Response.json({ error: errorMessage }, { status: 400, headers });
  }
  return Response.json({ ok: true }, { headers });
});
