import { fetchAllRows } from "@/lib/fetch-all-rows";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { generateReportPdf } from "@/lib/pdf";
import { t, money, numberFmt, fmtDate, fmtDateTime, localized } from "@/lib/i18n";
import {
  TrendingUp,
  Boxes,
  AlertTriangle,
  DollarSign,
  Building2,
  Package,
  Users,
  Wallet,
  PiggyBank,
  ArrowUpRight,
  Calendar,
  Plus,
  LogOut,
  UserPlus,
  ShoppingBag,
  Download,
} from "lucide-react";
import { useAuth, useIsOwner, useBranchId } from "@/lib/auth-context";
import { SetupBanner } from "@/components/setup-banner";
import { OwnerEveningReminder } from "@/components/owner-evening-reminder";
import { localDateInput } from "@/lib/utils";
import { toast } from "sonner";
import { QueryState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type WorkerActivity = {
  id: string;
  type: "sale" | "customer";
  createdAt: string;
  branchName: string;
  workerName: string;
  title: string;
  detail: string;
  amount?: number;
};

type WorkerDailyPerformance = {
  userId: string;
  workerName: string;
  salesCount: number;
  salesValue: number;
  customersAdded: number;
};

function Dashboard() {
  const { role, user, signOut } = useAuth();
  const isOwner = useIsOwner();
  const branchId = useBranchId();
  const today = localDateInput();
  const todayStart = new Date(`${today}T00:00:00`).toISOString();
  const tomorrow = new Date(`${today}T00:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = tomorrow.toISOString();

  // ---- Summary stats ----
  const {
    data: stats,
    isPending: statsPending,
    error: statsError,
    refetch: retryStats,
  } = useQuery({
    queryKey: ["dashboard-stats", branchId, isOwner, today],
    staleTime: 60_000,
    queryFn: async () => {
      const todaySalesQ = supabase
        .from("sales")
        .select("quantity, selling_price, profit")
        .eq("sale_date", today);
      if (!isOwner && branchId) todaySalesQ.eq("branch_id", branchId);

      const invQ = isOwner
        ? supabase
            .from("inventory")
            .select(
              "branch_id, product_id, quantity, avg_cost, products(name, unit, min_stock), branches(name)",
            )
        : supabase.from("inventory").select("branch_id, product_id, quantity, avg_cost");
      if (!isOwner && branchId) invQ.eq("branch_id", branchId);
      const expensesQ = supabase.from("expenses").select("amount").eq("expense_date", today);
      if (!isOwner && branchId) expensesQ.eq("branch_id", branchId);
      // These reads are independent; avoid a network round trip for every card.
      const [
        salesResult,
        inventoryResult,
        workerProductsResult,
        branchesResult,
        productsResult,
        workersResult,
        expensesResult,
        branchResult,
      ] = await Promise.all([
        todaySalesQ,
        invQ,
        !isOwner ? supabase.from("worker_products").select("id, name, unit, min_stock") : null,
        isOwner ? supabase.from("branches").select("id") : null,
        isOwner ? supabase.from("products").select("id") : null,
        isOwner ? supabase.from("user_roles").select("id") : null,
        expensesQ,
        !isOwner && branchId
          ? supabase.from("branches").select("name").eq("id", branchId).maybeSingle()
          : null,
      ]);
      const { data: sales, error: salesError } = salesResult;
      if (salesError) throw salesError;
      const { data: inventoryRows, error: inventoryError } = inventoryResult;
      if (inventoryError) throw inventoryError;
      let inv: Array<{
        branch_id: string;
        product_id: string;
        quantity: number;
        avg_cost: number;
        products?: { name: string | null; unit: string | null; min_stock: number | null } | null;
        branches?: { name: string } | null;
      }> = inventoryRows ?? [];

      if (!isOwner) {
        const { data: workerProducts, error: workerProductsError } = workerProductsResult!;
        if (workerProductsError) throw workerProductsError;
        const productMap = new Map(
          (workerProducts ?? []).flatMap((product) =>
            product.id ? [[product.id, product] as const] : [],
          ),
        );
        inv = inv.map((item) => ({ ...item, products: productMap.get(item.product_id) }));
      }

      if (branchesResult?.error) throw branchesResult.error;
      if (productsResult?.error) throw productsResult.error;
      if (workersResult?.error) throw workersResult.error;
      const branches = branchesResult?.data ?? [];
      const products = (isOwner ? productsResult?.data : workerProductsResult?.data) ?? [];
      const workers = workersResult?.data ?? [];
      const { data: exp, error: expensesError } = expensesResult;
      if (expensesError) throw expensesError;

      const todaySales = (sales ?? []).reduce(
        (s, x) => s + Number(x.selling_price) * Number(x.quantity),
        0,
      );
      const todayProfit = (sales ?? []).reduce((s, x) => s + Number(x.profit), 0);
      const todayExpenses = (exp ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const totalStock = (inv ?? []).reduce((s, x) => s + Number(x.quantity), 0);
      const totalStockValue = (inv ?? []).reduce(
        (s, x) => s + Number(x.quantity) * Number(x.avg_cost ?? 0),
        0,
      );
      const lowStock = (inv ?? []).filter(
        (item) =>
          Number(item.quantity) <=
          Number((item.products as { min_stock?: number } | null)?.min_stock ?? 0),
      );

      if (branchResult?.error) throw branchResult.error;

      return {
        todaySales,
        todaySalesCount: (sales ?? []).length,
        todayProfit,
        todayExpenses,
        todayNet: todayProfit - todayExpenses,
        totalStock,
        totalStockValue,
        lowStock,
        inventory: inv ?? [],
        branchCount: branches.length,
        productCount: products.length,
        workerCount: workers.length,
        branchName: branchResult?.data?.name ?? "",
      };
    },
  });

  // ---- Branch performance (owner only) ----
  const {
    data: branchStats,
    error: branchError,
    refetch: retryBranches,
  } = useQuery({
    queryKey: ["branch-performance", isOwner],
    enabled: isOwner,
    staleTime: 60_000,
    queryFn: async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      const ms = localDateInput(monthStart);

      const { data: br, error: branchesError } = await supabase
        .from("branches")
        .select("id, name, status, created_at");
      if (branchesError) throw branchesError;
      if (!br) return [];

      const results = await Promise.all(
        br.map(async (b) => {
          const salesQ = supabase
            .from("sales")
            .select("quantity, selling_price, profit")
            .eq("branch_id", b.id)
            .gte("sale_date", ms);
          const [salesResult, inventoryResult, workersResult] = await Promise.all([
            salesQ,
            supabase.from("inventory").select("quantity, avg_cost").eq("branch_id", b.id),
            supabase
              .from("user_roles")
              .select("id", { count: "exact", head: true })
              .eq("branch_id", b.id),
          ]);
          const { data: sales, error: salesError } = salesResult;
          if (salesError) throw salesError;
          const rev = (sales ?? []).reduce(
            (s, x) => s + Number(x.selling_price) * Number(x.quantity),
            0,
          );
          const profit = (sales ?? []).reduce((s, x) => s + Number(x.profit), 0);

          const { data: inv, error: inventoryError } = inventoryResult;
          if (inventoryError) throw inventoryError;
          const stockValue = (inv ?? []).reduce(
            (s, x) => s + Number(x.quantity) * Number(x.avg_cost ?? 0),
            0,
          );
          const totalStock = (inv ?? []).reduce((s, x) => s + Number(x.quantity), 0);

          const { count: workerCount, error: workersError } = workersResult;

          if (workersError) throw workersError;
          return {
            ...b,
            revenue: rev,
            profit,
            stockValue,
            totalStock,
            workerCount: workerCount ?? 0,
          };
        }),
      );
      return results;
    },
  });

  // ---- Recent sales ----
  const {
    data: recent,
    error: recentError,
    refetch: retryRecent,
  } = useQuery({
    queryKey: ["recent-sales", branchId, isOwner],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("sales")
        .select(
          "id, product_id, quantity, selling_price, profit, sale_date, customer_name, branches(name), created_by",
        )
        .order("created_at", { ascending: false })
        .limit(8);

      if (!isOwner && branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      const productQuery = isOwner
        ? supabase.from("products").select("id, name, unit")
        : supabase.from("worker_products").select("id, name, unit");
      const { data: products, error: productError } = await productQuery;
      if (productError) throw productError;
      const productMap = new Map((products ?? []).map((product) => [product.id, product]));
      return (data ?? []).map((sale) => ({ ...sale, products: productMap.get(sale.product_id) }));
    },
  });

  // ---- Recent activity created by workers (owner only) ----
  const {
    data: workerActivity = [],
    error: activityError,
    refetch: retryActivity,
  } = useQuery({
    queryKey: ["worker-activity"],
    enabled: isOwner,
    staleTime: 30_000,
    queryFn: async (): Promise<WorkerActivity[]> => {
      const [{ data: sales, error: salesError }, { data: customers, error: customersError }] =
        await Promise.all([
          supabase
            .from("sales")
            .select(
              "id, created_at, created_by, quantity, selling_price, customer_name, products(name), branches(name)",
            )
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("customers")
            .select("id, created_at, created_by, name, phone, branches(name)")
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

      if (salesError) throw salesError;
      if (customersError) throw customersError;

      const userIds = [
        ...new Set(
          [
            ...(sales ?? []).map((sale) => sale.created_by),
            ...(customers ?? []).map((customer) => customer.created_by),
          ].filter((id): id is string => Boolean(id)),
        ),
      ];
      if (userIds.length === 0) return [];

      const [{ data: roles, error: rolesError }, { data: profiles, error: profilesError }] =
        await Promise.all([
          supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
          supabase.from("profiles").select("id, full_name").in("id", userIds),
        ]);
      if (rolesError) throw rolesError;
      if (profilesError) throw profilesError;

      const workerIds = new Set(
        (roles ?? []).filter((role) => role.role !== "owner").map((role) => role.user_id),
      );
      const names = new Map(
        (profiles ?? []).map((profile) => [profile.id, profile.full_name.trim() || "Worker"]),
      );

      const saleActivity: WorkerActivity[] = (sales ?? [])
        .filter((sale) => sale.created_by && workerIds.has(sale.created_by))
        .map((sale) => ({
          id: `sale-${sale.id}`,
          type: "sale",
          createdAt: sale.created_at,
          branchName: sale.branches?.name ?? "Unassigned branch",
          workerName: names.get(sale.created_by!) ?? "Worker",
          title: `${sale.products?.name ?? "Product"} sold`,
          detail: sale.customer_name ?? "Walk-in customer",
          amount: Number(sale.selling_price) * Number(sale.quantity),
        }));
      const customerActivity: WorkerActivity[] = (customers ?? [])
        .filter((customer) => customer.created_by && workerIds.has(customer.created_by))
        .map((customer) => ({
          id: `customer-${customer.id}`,
          type: "customer",
          createdAt: customer.created_at,
          branchName: customer.branches?.name ?? "Unassigned branch",
          workerName: names.get(customer.created_by!) ?? "Worker",
          title: "Customer added",
          detail: customer.name,
        }));

      return [...saleActivity, ...customerActivity]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10);
    },
  });

  const {
    data: workerPerformance = [],
    error: performanceError,
    refetch: retryPerformance,
  } = useQuery({
    queryKey: ["worker-daily-performance", today],
    enabled: isOwner,
    staleTime: 30_000,
    queryFn: async (): Promise<WorkerDailyPerformance[]> => {
      const [sales, customers, roles] = await Promise.all([
        fetchAllRows(
          supabase
            .from("sales")
            .select("created_by, quantity, selling_price")
            .eq("sale_date", today)
            .order("id"),
        ),
        fetchAllRows(
          supabase
            .from("customers")
            .select("created_by")
            .gte("created_at", todayStart)
            .lt("created_at", tomorrowStart)
            .order("id"),
        ),
        fetchAllRows(
          supabase.from("user_roles").select("user_id, role").neq("role", "owner").order("id"),
        ),
      ]);

      const workerIds = (roles ?? []).map((role) => role.user_id);
      if (workerIds.length === 0) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", workerIds);
      if (profilesError) throw profilesError;

      const names = new Map(
        (profiles ?? []).map((profile) => [profile.id, profile.full_name.trim() || "Worker"]),
      );
      const performance = new Map(
        workerIds.map((id) => [
          id,
          {
            userId: id,
            workerName: names.get(id) ?? "Worker",
            salesCount: 0,
            salesValue: 0,
            customersAdded: 0,
          },
        ]),
      );
      for (const sale of sales ?? []) {
        if (!sale.created_by || !performance.has(sale.created_by)) continue;
        const row = performance.get(sale.created_by)!;
        row.salesCount += 1;
        row.salesValue += Number(sale.selling_price) * Number(sale.quantity);
      }
      for (const customer of customers ?? []) {
        if (!customer.created_by || !performance.has(customer.created_by)) continue;
        performance.get(customer.created_by)!.customersAdded += 1;
      }
      return [...performance.values()].sort(
        (a, b) => b.salesValue - a.salesValue || b.customersAdded - a.customersAdded,
      );
    },
  });

  const cards = [
    {
      label: t.todaySales,
      value: money(stats?.todaySales ?? 0),
      icon: TrendingUp,
      tone: "text-primary",
    },
    {
      label: t.todayProfit,
      value: money(stats?.todayProfit ?? 0),
      icon: DollarSign,
      tone: "text-green-600",
    },
    {
      label: t.todayExpenses,
      value: money(stats?.todayExpenses ?? 0),
      icon: Wallet,
      tone: "text-red-600",
    },
    {
      label: t.todayNet,
      value: money(stats?.todayNet ?? 0),
      icon: PiggyBank,
      tone: "text-primary",
    },
    {
      label: t.totalProducts,
      value: numberFmt(stats?.productCount ?? 0),
      icon: Package,
      tone: "text-primary",
    },
    ...(isOwner
      ? [
          {
            label: t.totalBranches,
            value: numberFmt(stats?.branchCount ?? 0),
            icon: Building2,
            tone: "text-primary",
          },
          {
            label: t.totalWorkers,
            value: numberFmt(stats?.workerCount ?? 0),
            icon: Users,
            tone: "text-primary",
          },
        ]
      : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  const downloadOverviewReport = async (period: "daily" | "weekly" | "monthly" | "annual") => {
    const now = new Date();
    let from = today;
    let to = today;
    if (period === "weekly") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      from = localDateInput(start);
      to = localDateInput(end);
    } else if (period === "monthly") {
      from = localDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
      to = localDateInput(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (period === "annual") {
      from = `${now.getFullYear()}-01-01`;
      to = `${now.getFullYear()}-12-31`;
    }

    try {
      const [sales, purchases, expenses, inventory] = await Promise.all([
        fetchAllRows(
          supabase
            .from("sales")
            .select(
              "quantity, selling_price, profit, sale_date, customer_name, products(name), branches(name)",
            )
            .gte("sale_date", from)
            .lte("sale_date", to)
            .order("sale_date", { ascending: false })
            .order("id"),
        ),
        fetchAllRows(
          supabase
            .from("purchases")
            .select(
              "quantity, buying_price, transport_cost, supplier, purchase_date, products(name), branches(name)",
            )
            .gte("purchase_date", from)
            .lte("purchase_date", to)
            .order("purchase_date", { ascending: false })
            .order("id"),
        ),
        fetchAllRows(
          supabase
            .from("expenses")
            .select("description, amount, expense_date, branches(name)")
            .gte("expense_date", from)
            .lte("expense_date", to)
            .order("expense_date", { ascending: false })
            .order("id"),
        ),
        fetchAllRows(
          supabase
            .from("inventory")
            .select("quantity, products(name, unit, min_stock), branches(name)")
            .order("quantity", { ascending: true })
            .order("branch_id")
            .order("product_id"),
        ),
      ]);

      const branchMap = new Map<
        string,
        { branch: string; sales: number; revenue: number; profit: number }
      >();
      for (const sale of sales ?? []) {
        const branch = sale.branches?.name ?? "Unassigned branch";
        const row = branchMap.get(branch) ?? { branch, sales: 0, revenue: 0, profit: 0 };
        row.sales += 1;
        row.revenue += Number(sale.selling_price) * Number(sale.quantity);
        row.profit += Number(sale.profit);
        branchMap.set(branch, row);
      }
      const totals = {
        sales: (sales ?? []).reduce(
          (sum, sale) => sum + Number(sale.selling_price) * Number(sale.quantity),
          0,
        ),
        profit: (sales ?? []).reduce((sum, sale) => sum + Number(sale.profit), 0),
        purchases: (purchases ?? []).reduce(
          (sum, purchase) =>
            sum +
            Number(purchase.buying_price) * Number(purchase.quantity) +
            Number(purchase.transport_cost),
          0,
        ),
        expenses: (expenses ?? []).reduce((sum, expense) => sum + Number(expense.amount), 0),
        net: 0,
        customers: new Set((sales ?? []).map((sale) => sale.customer_name).filter(Boolean)).size,
      };
      totals.net = totals.profit - totals.expenses;
      const label = period[0].toUpperCase() + period.slice(1);
      await generateReportPdf({
        title: `${label} Business Report`,
        period: `${fmtDate(from)} – ${fmtDate(to)}`,
        branchName: "All branches",
        sales: (sales ?? []).map((sale) => ({
          date: sale.sale_date,
          branch: sale.branches?.name ?? "Unassigned branch",
          product: sale.products?.name ?? "",
          customer: sale.customer_name ?? "Walk-in customer",
          qty: Number(sale.quantity),
          price: Number(sale.selling_price),
          profit: Number(sale.profit),
        })),
        purchases: (purchases ?? []).map((purchase) => ({
          date: purchase.purchase_date,
          branch: purchase.branches?.name ?? "Unassigned branch",
          product: purchase.products?.name ?? "",
          supplier: purchase.supplier,
          qty: Number(purchase.quantity),
          price: Number(purchase.buying_price),
          transport: Number(purchase.transport_cost),
        })),
        expenses: (expenses ?? []).map((expense) => ({
          date: expense.expense_date,
          branch: expense.branches?.name ?? "Unassigned branch",
          description: expense.description,
          amount: Number(expense.amount),
        })),
        inventory: (inventory ?? []).map((item) => {
          const quantity = Number(item.quantity);
          const minimum = Number(item.products?.min_stock ?? 0);
          return {
            branch: item.branches?.name ?? "Unassigned branch",
            product: item.products?.name ?? "Product",
            quantity,
            unit: item.products?.unit ?? "",
            status: quantity <= 0 ? "Out of stock" : quantity <= minimum ? "Low stock" : "In stock",
          };
        }),
        totals,
        branchPerformance: [...branchMap.values()].sort((a, b) => b.revenue - a.revenue),
      });
    } catch (error) {
      toast.error("Unable to create the report. Please try again.");
      console.error("[DashboardPdf]", error);
    }
  };

  if (statsPending || statsError)
    return <QueryState pending={statsPending} error={statsError} retry={() => void retryStats()} />;

  return (
    <div className="space-y-6">
      <QueryState
        error={branchError || recentError || activityError || performanceError}
        retry={() => {
          void retryRecent();
          if (isOwner) {
            void retryBranches();
            void retryActivity();
            void retryPerformance();
          }
        }}
      />
      <section className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {isOwner ? "Business overview" : t.currentBranch}
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.dashboard}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
              {isOwner
                ? "Monitor sales, stock, profitability and branch performance from one place."
                : localized("Reba ibikorwa byawe bya buri munsi.", "Review your daily activity.")}
            </p>
            {!isOwner && branchId && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-semibold">
                <Building2 className="h-4 w-4 text-primary" />
                {stats?.branchName || "Your assigned branch"}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isOwner ? (
              <>
                <Link
                  to="/products"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border bg-background px-3 text-xs font-semibold transition hover:bg-muted"
                >
                  <Plus className="h-4 w-4" /> {t.products}
                </Link>
                <Link
                  to="/purchases"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
                >
                  <Plus className="h-4 w-4" /> {t.purchases}
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Download className="mr-2 h-4 w-4" /> Download PDF
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuLabel>Business report</DropdownMenuLabel>
                    <DropdownMenuItem onSelect={() => void downloadOverviewReport("daily")}>
                      Daily report
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void downloadOverviewReport("weekly")}>
                      Weekly report
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void downloadOverviewReport("monthly")}>
                      Monthly report
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void downloadOverviewReport("annual")}>
                      Annual report
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <OwnerEveningReminder
                  salesValue={money(stats?.todaySales ?? 0)}
                  salesCount={stats?.todaySalesCount ?? 0}
                />
                <Button variant="outline" size="sm" onClick={handleSignOut} className="h-9">
                  <LogOut className="mr-2 h-4 w-4" /> {t.signOut}
                </Button>
              </>
            ) : (
              <Link
                to="/sales"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" /> {t.sales}
              </Link>
            )}
          </div>
        </div>
      </section>

      {isOwner && (
        <SetupBanner
          steps={[
            ...(stats && stats.branchCount === 0
              ? [{ message: "Step 1: Add your first branch.", to: "/branches", label: t.branches }]
              : []),
            ...(stats && stats.productCount === 0
              ? [{ message: "Step 2: Add your first product.", to: "/products", label: t.products }]
              : []),
            ...(stats && stats.branchCount > 0 && stats.productCount > 0 && stats.totalStock === 0
              ? [
                  {
                    message: "Step 3: Record a purchase to stock your inventory.",
                    to: "/purchases",
                    label: t.purchases,
                  },
                ]
              : []),
          ]}
        />
      )}

      {!isOwner && (
        <Card>
          <CardHeader className="border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold">Available stock</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Stock received and maintained by the business owner for your assigned branch.
              </p>
            </div>
            <Link to="/inventory" className="text-xs font-semibold text-primary hover:underline">
              View inventory <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.inventory.length ? (
              <div className="divide-y">
                {stats.inventory.map((item) => {
                  const quantity = Number(item.quantity);
                  const minimum = Number(
                    (item.products as { min_stock?: number } | null)?.min_stock ?? 0,
                  );
                  const status =
                    quantity <= 0 ? "Out of stock" : quantity <= minimum ? "Low stock" : "In stock";
                  const statusClass =
                    quantity <= 0
                      ? "bg-red-100 text-red-800"
                      : quantity <= minimum
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800";
                  return (
                    <div
                      key={`${item.branch_id}-${item.product_id}`}
                      className="flex items-center justify-between gap-4 px-5 py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Boxes className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {(item.products as { name?: string } | null)?.name ?? "Product"}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            Minimum: {numberFmt(minimum)}{" "}
                            {(item.products as { unit?: string } | null)?.unit ?? "kg"}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold">
                          {numberFmt(quantity)}{" "}
                          {(item.products as { unit?: string } | null)?.unit ?? ""}
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${statusClass}`}
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <Boxes className="mx-auto h-8 w-8 text-muted-foreground/35" />
                <p className="mt-2 text-sm font-medium">No stock available yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  The owner will add stock to this branch through purchases.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card
            key={c.label}
            className="group border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="mt-2 text-xl font-extrabold tracking-tight sm:text-2xl">
                    {c.value}
                  </p>
                </div>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <c.icon className={`h-[18px] w-[18px] ${c.tone}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {isOwner && branchStats && (
        <Card>
          <CardHeader className="border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold">{t.branchPerformance}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Performance for the current month
              </p>
            </div>
            <Link to="/branches" className="text-xs font-semibold text-primary hover:underline">
              View branches <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground">
                  <tr className="text-left">
                    <th className="px-5 py-3 font-semibold">{t.branch}</th>
                    <th className="px-5 py-3 font-semibold">{t.revenue}</th>
                    <th className="px-5 py-3 font-semibold">{t.profit}</th>
                    <th className="px-5 py-3 font-semibold">{t.totalWorkers}</th>
                    <th className="px-5 py-3 text-right font-semibold">{t.currentStock}</th>
                  </tr>
                </thead>
                <tbody>
                  {branchStats.length ? (
                    branchStats.map((b) => (
                      <tr key={b.id} className="border-t transition hover:bg-muted/30">
                        <td className="px-5 py-3.5 font-semibold">{b.name}</td>
                        <td className="px-5 py-3.5 font-medium">{money(b.revenue)}</td>
                        <td className="px-5 py-3.5 font-semibold text-emerald-600">
                          {money(b.profit)}
                        </td>
                        <td className="px-5 py-3.5">{numberFmt(b.workerCount)}</td>
                        <td className="px-5 py-3.5 text-right">
                          {numberFmt(b.totalStock)} {b.totalStock ? "KG" : ""}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-5 py-10 text-center text-sm text-muted-foreground"
                      >
                        {t.noData}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader className="border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold">Today’s worker performance</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Daily sales and customers added by each worker.
              </p>
            </div>
            <Link to="/sales" className="text-xs font-semibold text-primary hover:underline">
              View daily sales <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {workerPerformance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold">Worker</th>
                      <th className="px-5 py-3 text-right font-semibold">Sales</th>
                      <th className="px-5 py-3 text-right font-semibold">Sales value</th>
                      <th className="px-5 py-3 text-right font-semibold">Customers added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workerPerformance.map((worker) => (
                      <tr key={worker.userId} className="border-t transition hover:bg-muted/30">
                        <td className="px-5 py-3.5 font-semibold">{worker.workerName}</td>
                        <td className="px-5 py-3.5 text-right">{numberFmt(worker.salesCount)}</td>
                        <td className="px-5 py-3.5 text-right font-semibold">
                          {money(worker.salesValue)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          {numberFmt(worker.customersAdded)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/35" />
                <p className="mt-2 text-sm font-medium">No workers assigned yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Daily team performance will appear here as workers record sales and customers.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card>
          <CardHeader className="border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base font-bold">Worker activity</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Recent sales and customer records created by your team.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <Link to="/customers" className="text-primary hover:underline">
                Customers
              </Link>
              <Link to="/sales" className="text-primary hover:underline">
                Sales <ArrowUpRight className="ml-1 inline h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {workerActivity.length > 0 ? (
              <div className="divide-y">
                {workerActivity.map((activity) => {
                  const Icon = activity.type === "sale" ? ShoppingBag : UserPlus;
                  return (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-muted/30"
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${activity.type === "sale" ? "bg-primary/10 text-primary" : "bg-sky-100 text-sky-700"}`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{activity.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {activity.detail} · {activity.branchName}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {activity.amount !== undefined && (
                          <p className="text-sm font-bold">{money(activity.amount)}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {activity.workerName} · {fmtDateTime(activity.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <Users className="mx-auto h-8 w-8 text-muted-foreground/35" />
                <p className="mt-2 text-sm font-medium">No worker activity yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sales and customers recorded by workers will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">{t.recentTransactions}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Latest sales recorded in the system
                </p>
              </div>
              <Link to="/sales" className="text-xs font-semibold text-primary hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recent && recent.length > 0 ? (
              <div className="divide-y">
                {recent.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 transition hover:bg-muted/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{s.products?.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {s.branches?.name} · {fmtDate(s.sale_date)} ·{" "}
                        {s.customer_name ?? "Walk-in customer"}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold">
                        {money(Number(s.selling_price) * Number(s.quantity))}
                      </p>
                      <p className="mt-0.5 text-xs font-semibold text-emerald-600">
                        +{money(s.profit)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <TrendingUp className="mx-auto h-8 w-8 text-muted-foreground/35" />
                <p className="mt-2 text-sm font-medium">{t.noData}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sales will appear here as they are recorded.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b pb-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold">{t.lowStockLabel}</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Products below 1,000 kg that may need restocking
                </p>
              </div>
              <Link to="/inventory" className="text-xs font-semibold text-primary hover:underline">
                Manage stock
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.lowStock && stats.lowStock.length > 0 ? (
              <div className="divide-y">
                {stats.lowStock.map((i) => (
                  <div
                    key={i.product_id}
                    className="flex items-center justify-between gap-4 px-5 py-3.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <p className="truncate text-sm font-semibold">{i.products?.name}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                      {numberFmt(i.quantity)} / {i.products?.unit}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <Boxes className="mx-auto h-8 w-8 text-emerald-600/45" />
                <p className="mt-2 text-sm font-medium">Stock levels look healthy</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {localized("Nta bicuruzwa bifite ububiko buke.", "No products are low in stock.")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
