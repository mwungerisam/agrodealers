import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { t, money, numberFmt, formatErrorMessage, localized } from "@/lib/i18n";
import { useIsOwner, useBranchId } from "@/lib/auth-context";
import { StockBadge } from "@/lib/stock-badge";
import { QueryState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const isOwner = useIsOwner();
  const branchId = useBranchId();
  const qc = useQueryClient();

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<{
    branch_id: string;
    product_id: string;
    product_name: string;
    branch_name: string;
    current_qty: number;
  } | null>(null);
  const [newQty, setNewQty] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  const {
    data: inventory = [],
    error: inventoryError,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["inventory-list", branchId, isOwner],
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase
        .from("inventory")
        .select(
          "quantity, avg_cost, product_id, branch_id, products(name, unit, category, min_stock), branches(name, code)",
        );
      if (!isOwner && branchId) q = q.eq("branch_id", branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalItems = inventory.length;
  const totalValue = inventory.reduce(
    (s, i) => s + Number(i.quantity) * Number(i.avg_cost ?? 0),
    0,
  );
  const lowCount = inventory.filter(
    (i) => Number(i.quantity) > 0 && Number(i.quantity) <= Number(i.products?.min_stock ?? 0),
  ).length;
  const outCount = inventory.filter((i) => Number(i.quantity) <= 0).length;

  const adjustStock = useMutation({
    mutationFn: async () => {
      if (!adjustingItem) throw new Error(t.requiredField);
      const qty = Number(newQty);
      if (!Number.isFinite(qty) || qty < 0)
        throw new Error("Enter a valid quantity of zero or more.");
      const { error } = await supabase.rpc("adjust_stock", {
        p_branch_id: adjustingItem.branch_id,
        p_product_id: adjustingItem.product_id,
        p_new_quantity: qty,
        p_reason: adjustReason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.stockAdjusted);
      qc.invalidateQueries({ queryKey: ["inventory-list"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setAdjustOpen(false);
      setAdjustingItem(null);
      setNewQty("");
      setAdjustReason("");
    },
    onError: (e: Error) => {
      toast.error(formatErrorMessage(e));
    },
  });

  const openAdjust = (item: (typeof inventory)[number]) => {
    setAdjustingItem({
      branch_id: item.branch_id,
      product_id: item.product_id,
      product_name: item.products?.name ?? "—",
      branch_name: item.branches?.name ?? "—",
      current_qty: Number(item.quantity),
    });
    setNewQty(String(Number(item.quantity)));
    setAdjustReason("");
    setAdjustOpen(true);
  };

  if (!isOwner) return <Navigate to="/dashboard" replace />;
  if (isPending || inventoryError)
    return <QueryState pending={isPending} error={inventoryError} retry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.inventory}</h1>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? localized(
                "Reba ububiko bwose n'imiterere yabwo muri buri shami.",
                "Review all inventory and its status in every branch.",
              )
            : localized(
                "Reba ububiko bw'ishami waherewemo.",
                "Review inventory assigned to your branch.",
              )}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">{t.totalProducts}</p>
            <p className="text-2xl font-bold">{numberFmt(totalItems)}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">{t.totalInventoryValue}</p>
            <p className="text-2xl font-bold">{money(totalValue)}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">{t.lowStockLabel}</p>
            <p className="text-2xl font-bold text-orange-600">{numberFmt(lowCount)}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-muted-foreground">{t.outOfStock}</p>
            <p className="text-2xl font-bold text-red-600">{numberFmt(outCount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.stockAdjustment}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md bg-muted/30 p-3 text-sm">
              <p>
                <strong>{t.product}:</strong> {adjustingItem?.product_name}
              </p>
              <p>
                <strong>{t.branch}:</strong> {adjustingItem?.branch_name}
              </p>
              <p>
                <strong>{t.currentStock}:</strong> {numberFmt(adjustingItem?.current_qty ?? 0)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                {t.quantity} {t.new} *
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={newQty}
                onChange={(e) => setNewQty(e.target.value)}
              />
              {Number(newQty) > (adjustingItem?.current_qty ?? 0) && (
                <p className="text-xs text-green-600">
                  {localized(
                    "Andika impamvu yo guhindura ububiko",
                    "Enter the reason for this inventory adjustment",
                  )}
                </p>
              )}
              {Number(newQty) < (adjustingItem?.current_qty ?? 0) && (
                <p className="text-xs text-orange-600">
                  {localized(
                    "Sobanura impamvu, urugero: ibyangiritse cyangwa ibarura rishya",
                    "Explain the reason, for example damaged goods or a new stock count",
                  )}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Ingingo *</Label>
              <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              {t.cancel}
            </Button>
            <Button
              onClick={() => adjustStock.mutate()}
              disabled={adjustStock.isPending || !adjustReason.trim() || !newQty}
              variant={
                Number(newQty) < (adjustingItem?.current_qty ?? 0) ? "destructive" : "default"
              }
            >
              {adjustStock.isPending && <span className="mr-2 animate-spin">↻</span>}
              {t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Inventory table */}
      <Card>
        <CardHeader>
          <CardTitle>{t.inventoryReport}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.product}</TableHead>
                  <TableHead>{t.category}</TableHead>
                  <TableHead>{t.branch}</TableHead>
                  <TableHead className="text-right">{t.quantity}</TableHead>
                  <TableHead className="text-right">{t.unit}</TableHead>
                  <TableHead className="text-right">{t.avgCost}</TableHead>
                  <TableHead className="text-right">{t.totalAmount}</TableHead>
                  <TableHead>{t.stockStatus}</TableHead>
                  {isOwner && <TableHead className="text-right">{t.actions}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={isOwner ? 9 : 8}
                      className="py-10 text-center text-muted-foreground"
                    >
                      {t.noStock}
                    </TableCell>
                  </TableRow>
                ) : (
                  inventory.map((i) => {
                    const qty = Number(i.quantity);
                    const min = Number(i.products?.min_stock ?? 0);
                    const value = qty * Number(i.avg_cost);
                    return (
                      <TableRow key={`${i.branch_id}-${i.product_id}`}>
                        <TableCell className="font-medium">{i.products?.name}</TableCell>
                        <TableCell>
                          <span className="capitalize">{i.products?.category ?? "—"}</span>
                        </TableCell>
                        <TableCell>
                          {isOwner ? i.branches?.name : "—"}
                          {isOwner && i.branches?.code && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              ({i.branches.code})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{numberFmt(qty)}</TableCell>
                        <TableCell className="text-right">{i.products?.unit ?? "—"}</TableCell>
                        <TableCell className="text-right">{money(i.avg_cost)}</TableCell>
                        <TableCell className="text-right font-semibold">{money(value)}</TableCell>
                        <TableCell>
                          <StockBadge qty={qty} min={min} />
                        </TableCell>
                        {isOwner && (
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline" onClick={() => openAdjust(i)}>
                              {t.stockAdjustment}
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
