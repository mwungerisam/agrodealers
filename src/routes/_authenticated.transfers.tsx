import { QueryState } from "@/components/query-state";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, Search, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { t, money, numberFmt, fmtDate, formatErrorMessage, localized } from "@/lib/i18n";
import { useIsOwner } from "@/lib/auth-context";
import { SetupBanner } from "@/components/setup-banner";

export const Route = createFileRoute("/_authenticated/transfers")({
  component: TransfersPage,
});

interface Movement {
  id: string;
  branch_id: string;
  product_id: string;
  type: "in" | "out";
  quantity: number;
  ref_type: string | null;
  ref_id: string | null;
  created_at: string;
  branches?: { name: string };
  products?: { name: string; unit: string };
}

function TransfersPage() {
  const isOwner = useIsOwner();

  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    from_branch: "",
    to_branch: "",
    product_id: "",
    quantity: "",
    reason: "",
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, code")
        .eq("status", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, unit")
        .eq("status", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Inventory at the source branch for the selected product
  const { data: sourceStock } = useQuery({
    queryKey: ["transfer-stock", form.from_branch, form.product_id],
    enabled: !!form.from_branch && !!form.product_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory")
        .select("quantity, avg_cost")
        .eq("branch_id", form.from_branch)
        .eq("product_id", form.product_id)
        .maybeSingle();
      if (error) throw error;
      return data ?? { quantity: 0, avg_cost: 0 };
    },
  });

  // Recent transfers (movements with ref_type = 'transfer')
  const {
    data: movements = [],
    isPending: pagePending,
    error: pageError,
    refetch: retryPage,
  } = useQuery({
    queryKey: ["transfer-movements"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select(
          "id, branch_id, product_id, type, quantity, ref_type, created_at, products(name, unit), branches(name)",
        )
        .eq("ref_type", "transfer")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      return (data ?? []) as Movement[];
    },
  });

  const selectedProduct = products.find((p) => p.id === form.product_id);
  const availableQty = Number(sourceStock?.quantity ?? 0);

  const canSave = () => {
    if (!form.from_branch) return t.chooseBranch;
    if (!form.to_branch)
      return localized("Hitamo ishami ryo kwakira ububiko.", "Select the receiving branch.");
    if (!form.product_id) return t.chooseProduct;
    if (!form.quantity || Number(form.quantity) <= 0) return t.invalidNumber;
    if (Number(form.quantity) > availableQty) return t.noStockEnough;
    return null;
  };

  const save = useMutation({
    mutationFn: async () => {
      const err = canSave();
      if (err) throw new Error(err);
      const { error } = await supabase.rpc("transfer_stock", {
        p_from_branch: form.from_branch,
        p_to_branch: form.to_branch,
        p_product_id: form.product_id,
        p_quantity: Number(form.quantity),
        p_reason: form.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.transferComplete);
      qc.invalidateQueries({ queryKey: ["transfer-movements"] });
      qc.invalidateQueries({ queryKey: ["inventory-list"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setForm({ from_branch: "", to_branch: "", product_id: "", quantity: "", reason: "" });
    },
    onError: (e: Error) => {
      toast.error(formatErrorMessage(e));
    },
  });

  const fromBranches = branches.filter((b) => b.id !== form.to_branch);
  const toBranches = branches.filter((b) => b.id !== form.from_branch);

  const filteredMovements = movements.filter(
    (m) =>
      m.products?.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.branches?.name?.toLowerCase().includes(search.toLowerCase()),
  );

  const openNew = () => {
    setForm({ from_branch: "", to_branch: "", product_id: "", quantity: "", reason: "" });
    setOpen(true);
  };

  if (!isOwner) return <Navigate to="/dashboard" replace />;

  if (pagePending || pageError)
    return <QueryState pending={pagePending} error={pageError} retry={() => void retryPage()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.transfers}</h1>
          <p className="text-sm text-muted-foreground">
            {localized(
              "Hindura ububiko ubugenzure hagati y'amashami.",
              "Move inventory between branches with a complete record.",
            )}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={branches.length === 0 || products.length === 0} onClick={openNew}>
              <ArrowLeftRight className="mr-2 h-4 w-4" /> {t.add}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{localized("Iyimura ry'ububiko", "Stock transfer")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* From branch */}
              <div className="space-y-2">
                <Label>Sending branch *</Label>
                <Select
                  value={form.from_branch}
                  onValueChange={(v) =>
                    setForm({ ...form, from_branch: v, product_id: "", quantity: "" })
                  }
                  disabled={branches.length <= 1}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fromBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.code ? `(${b.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* To branch */}
              <div className="space-y-2">
                <Label>Receiving branch *</Label>
                <Select
                  value={form.to_branch}
                  onValueChange={(v) =>
                    setForm({ ...form, to_branch: v, product_id: "", quantity: "" })
                  }
                  disabled={branches.length <= 1}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {toBranches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} {b.code ? `(${b.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product */}
              <div className="space-y-2">
                <Label>{t.product} *</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(v) => setForm({ ...form, product_id: v, quantity: "" })}
                  disabled={
                    !form.from_branch || !form.to_branch || form.from_branch === form.to_branch
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} ({p.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.from_branch && form.product_id && selectedProduct && (
                  <p className="text-xs text-muted-foreground">
                    {t.currentStock}: <strong>{numberFmt(availableQty)}</strong>{" "}
                    {selectedProduct.unit ?? ""} · {t.avgCost}:{" "}
                    {money(Number(sourceStock?.avg_cost ?? 0))}
                  </p>
                )}
              </div>

              {/* Quantity */}
              <div className="space-y-2">
                <Label>{t.quantity} *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                  max={availableQty}
                />
                {form.from_branch && form.product_id && Number(form.quantity) > availableQty && (
                  <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                    {t.noStockEnough} — Hari {numberFmt(availableQty)} {selectedProduct?.unit ?? ""}{" "}
                    ariko wifuza {form.quantity} {selectedProduct?.unit ?? ""}.
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Reason (optional)</Label>
                <Input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t.cancel}
              </Button>
              <Button
                onClick={() => save.mutate()}
                disabled={save.isPending || !!canSave()}
                className="gap-1"
              >
                {save.isPending && <span className="animate-spin">↻</span>}
                <ArrowLeftRight className="h-4 w-4" />
                Confirm transfer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <SetupBanner
        steps={[
          ...(branches.length === 0
            ? [
                {
                  message: localized(
                    "Banza wongereho ishami mbere yo kwimura ububiko.",
                    "Add a branch before transferring inventory.",
                  ),
                  to: "/branches",
                  label: t.branches,
                },
              ]
            : []),
          ...(branches.length > 0 && branches.length < 2
            ? [
                {
                  message: localized(
                    "Ongeraho nibura amashami abiri kugira ngo ubashe kwimura ububiko.",
                    "Add at least two branches before transferring inventory.",
                  ),
                  to: "/branches",
                  label: t.branches,
                },
              ]
            : []),
          ...(products.length === 0
            ? [
                {
                  message: localized(
                    "Banza wongereho igicuruzwa mbere yo kwimura ububiko.",
                    "Add a product before transferring inventory.",
                  ),
                  to: "/products",
                  label: t.products,
                },
              ]
            : []),
        ]}
      />

      {/* Transfers log */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Transfer activity ({numberFmt(movements.length)})</CardTitle>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.product}</TableHead>
                  <TableHead>{t.branch}</TableHead>
                  <TableHead>{t.quantity}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {movements.length === 0
                        ? t.noData
                        : localized(
                            "Nta yandi makuru ahari.",
                            "No additional records are available.",
                          )}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{fmtDate(m.created_at)}</TableCell>
                      <TableCell className="font-medium">{m.products?.name ?? "—"}</TableCell>
                      <TableCell>
                        {m.branches?.name ?? "—"}
                        <span className="mx-1 text-xs text-muted-foreground">
                          {m.type === "out" ? "→" : "←"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={m.type === "out" ? "text-red-600" : "text-green-600"}>
                          {m.type === "out" ? "−" : "+"}
                          {numberFmt(m.quantity)}
                        </span>{" "}
                        {m.products?.unit ?? ""}
                      </TableCell>
                      <TableCell>
                        {m.type === "out" ? "Kuva → " : "Kugeza → "}
                        {m.branches?.name ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
