import { QueryState } from "@/components/query-state";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { t, money, fmtDate, formatErrorMessage, localized } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { SetupBanner } from "@/components/setup-banner";
import { localDateInput } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/purchases")({
  component: PurchasesPage,
});

function PurchasesPage() {
  const { role, user } = useAuth();
  const isOwner = role?.role === "owner";

  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    branch_id: role?.branch_id ?? "",
    product_id: "",
    supplier: "",
    quantity: "",
    buying_price: "",
    transport_cost: "",
    purchase_date: localDateInput(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
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
        .select("id, name, unit, buying_price")
        .eq("status", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const {
    data: purchases = [],
    isPending: pagePending,
    error: pageError,
    refetch: retryPage,
  } = useQuery({
    queryKey: ["purchases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select(
          "id, quantity, buying_price, transport_cost, supplier, purchase_date, products(name, unit), branches(name)",
        )
        .order("purchase_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.branch_id) throw new Error(t.chooseBranch);
      if (!form.product_id) throw new Error(t.chooseProduct);
      const quantity = Number(form.quantity);
      const buyingPrice = Number(form.buying_price);
      const transportCost = Number(form.transport_cost || 0);
      if (
        !form.quantity ||
        !form.buying_price ||
        !Number.isFinite(quantity) ||
        !Number.isFinite(buyingPrice) ||
        !Number.isFinite(transportCost) ||
        quantity <= 0 ||
        buyingPrice < 0 ||
        transportCost < 0
      )
        throw new Error(t.invalidNumber);
      if (!form.supplier.trim()) throw new Error(t.requiredField);
      const { error } = await supabase.from("purchases").insert({
        ...form,
        quantity,
        buying_price: buyingPrice,
        transport_cost: transportCost,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.saved);
      qc.invalidateQueries({ queryKey: ["purchases"] });
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setOpen(false);
      setForm({
        ...form,
        product_id: "",
        supplier: "",
        quantity: "",
        buying_price: "",
        transport_cost: "",
      });
    },
    onError: (e: Error) => toast.error(formatErrorMessage(e)),
  });

  if (role && !isOwner) return <Navigate to="/dashboard" replace />;

  if (pagePending || pageError)
    return <QueryState pending={pagePending} error={pageError} retry={() => void retryPage()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.purchases}</h1>
          <p className="text-sm text-muted-foreground">
            {localized(
              "Andika amakuru y'amasoko y'ibicuruzwa.",
              "Owner-only stock receiving. Select an approved catalogue product and record the supplier purchase.",
            )}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={branches.length === 0 || products.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> {t.add}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t.add} {t.purchases}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
              {isOwner && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>{t.branch} *</Label>
                  <Select
                    value={form.branch_id}
                    onValueChange={(v) => setForm({ ...form, branch_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2 sm:col-span-2">
                <Label>{t.product} *</Label>
                <Select
                  value={form.product_id}
                  onValueChange={(v) => {
                    const p = products.find((x) => x.id === v);
                    setForm({
                      ...form,
                      product_id: v,
                      buying_price: p?.buying_price ? String(p.buying_price) : "",
                    });
                  }}
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
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t.supplier} *</Label>
                <Input
                  value={form.supplier}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.quantity} *</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Enter quantity"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.buyingPrice} *</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Enter purchase price"
                  value={form.buying_price}
                  onChange={(e) => setForm({ ...form, buying_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.transportCost}</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Optional"
                  value={form.transport_cost}
                  onChange={(e) => setForm({ ...form, transport_cost: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.purchaseDate} *</Label>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                {t.cancel}
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                {t.save}
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
                    "Banza wongereho ishami mbere yo kwandika isoko.",
                    "Add a branch before recording a purchase.",
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
                    "Banza wongereho igicuruzwa mbere yo kwandika isoko.",
                    "Add a product before recording a purchase.",
                  ),
                  to: "/products",
                  label: t.products,
                },
              ]
            : []),
        ]}
      />

      <Card>
        <CardHeader />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.branch}</TableHead>
                <TableHead>{t.product}</TableHead>
                <TableHead>{t.supplier}</TableHead>
                <TableHead>{t.quantity}</TableHead>
                <TableHead>{t.buyingPrice}</TableHead>
                <TableHead>{t.transportCost}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                purchases.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{fmtDate(p.purchase_date)}</TableCell>
                    <TableCell>{p.branches?.name}</TableCell>
                    <TableCell className="font-medium">{p.products?.name}</TableCell>
                    <TableCell>{p.supplier}</TableCell>
                    <TableCell>
                      {p.quantity} {p.products?.unit}
                    </TableCell>
                    <TableCell>{money(p.buying_price)}</TableCell>
                    <TableCell>{money(p.transport_cost)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
