import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth-context";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_38%),linear-gradient(135deg,#f8fafc_0%,#eef8f1_100%)] px-4">
        <div className="flex flex-col items-center gap-5 rounded-[28px] border border-border/70 bg-white/90 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-green-600 to-lime-500 shadow-lg shadow-emerald-500/25">
            <div className="absolute inset-1 rounded-xl border border-white/30" />
            <Loader2 className="relative h-7 w-7 animate-spin text-white" />
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-700/90">
              UFBC AGRODEALER
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Starting securely</h2>
            <p className="mt-1 text-sm text-slate-500">Checking your access…</p>
          </div>
        </div>
      </div>
    );
  }
  if (user) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/auth" replace />;
}
