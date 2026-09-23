import { createFileRoute, Outlet, Navigate, Link, useRouterState } from "@tanstack/react-router";
import { useAuth, useIsOwner } from "@/lib/auth-context";
import {
  Loader2,
  LogOut,
  LayoutDashboard,
  Building2,
  Package,
  ShoppingCart,
  TrendingUp,
  Boxes,
  FileText,
  Wallet,
  Users,
  Sprout,
  UserCheck,
  Shield,
  ArrowLeftRight,
  KeyRound,
  ChevronRight,
} from "lucide-react";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user, loading, unavailable, refreshRole, signOut } = useAuth();
  const isOwner = useIsOwner();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

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
            <h2 className="mt-2 text-lg font-semibold text-slate-900">Loading your dashboard</h2>
            <p className="mt-1 text-sm text-slate-500">Syncing your secure workspace…</p>
          </div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (unavailable) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/25 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-foreground">Workspace unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We could not verify your access right now. Check your connection and try again.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => void refreshRole()}>
              Try again
            </Button>
            <Button onClick={() => void signOut()}>{t.signOut}</Button>
          </div>
        </div>
      </div>
    );
  }

  const workerNav = [
    { to: "/dashboard", label: t.dashboard, icon: LayoutDashboard },
    { to: "/sales", label: t.sales, icon: TrendingUp },
    { to: "/customers", label: t.customers, icon: UserCheck },
    { to: "/account", label: t.account, icon: KeyRound },
  ];

  const adminNav = [
    { to: "/dashboard", label: t.dashboard, icon: LayoutDashboard },
    { to: "/branches", label: t.branches, icon: Building2 },
    { to: "/transfers", label: t.transfers, icon: ArrowLeftRight },
    { to: "/products", label: t.products, icon: Package },
    { to: "/purchases", label: t.purchases, icon: ShoppingCart },
    { to: "/sales", label: t.sales, icon: TrendingUp },
    { to: "/inventory", label: t.inventory, icon: Boxes },
    { to: "/expenses", label: t.expenses, icon: Wallet },
    { to: "/customers", label: t.customers, icon: UserCheck },
    { to: "/users", label: t.users, icon: Users },
    { to: "/audit", label: t.audit, icon: Shield },
    { to: "/reports", label: t.reports, icon: FileText },
    { to: "/account", label: t.account, icon: KeyRound },
  ];

  const nav = isOwner ? adminNav : workerNav;
  const current = nav.find((item) => pathname === item.to || pathname.startsWith(item.to + "/"));

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  return (
    <div className="min-h-screen bg-muted/25">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[272px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-sidebar-border px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Sprout className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold tracking-wide">UFBC AGRODEALER</p>
            <p className="text-[11px] text-sidebar-foreground/60">Business management system</p>
          </div>
        </div>

        <div className="px-4 pt-5">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-sidebar-foreground/45">
            Workspace
          </p>
          <nav className="space-y-1">
            {nav.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all ${
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {active && <ChevronRight className="h-4 w-4 opacity-70" />}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-auto p-4">
          <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent/50 p-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sidebar-primary/20 text-sm font-bold text-sidebar-primary">
                {(user.email?.[0] ?? "U").toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">{user.email}</p>
                <p className="mt-0.5 text-[10px] text-sidebar-foreground/55">
                  {isOwner ? t.owner : t.worker}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {t.signOut}
            </Button>
          </div>
        </div>
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b bg-sidebar px-4 text-sidebar-foreground shadow-sm md:hidden">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Sprout className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-extrabold">UFBC AGRODEALER</p>
            <p className="truncate text-[9px] text-sidebar-foreground/55">
              {current?.label ?? t.dashboard}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSignOut}
          className="text-sidebar-foreground"
          aria-label={t.signOut}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>

      <main className="min-h-screen md:pl-[272px]">
        <header className="sticky top-0 z-30 hidden h-[76px] items-center justify-between border-b bg-background/90 px-8 backdrop-blur md:flex">
          <div>
            <p className="text-xs font-medium text-muted-foreground">UFBC Agrodealer</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Workspace</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="text-sm font-semibold text-foreground">
                {current?.label ?? t.dashboard}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right lg:block">
              <p className="text-xs font-semibold">{isOwner ? t.owner : t.worker}</p>
              <p className="max-w-[240px] truncate text-[11px] text-muted-foreground">
                {user.email}
              </p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full border bg-muted text-xs font-bold">
              {(user.email?.[0] ?? "U").toUpperCase()}
            </div>
          </div>
        </header>

        <div className="h-14 md:hidden" />
        <nav
          aria-label="Primary navigation"
          className="scrollbar-none sticky top-14 z-30 flex overflow-x-auto border-b bg-background/95 px-2 backdrop-blur md:hidden"
        >
          {nav.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-xs font-semibold transition-colors ${
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground"
                }`}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
