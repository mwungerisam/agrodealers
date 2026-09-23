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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { t, money, fmtDate, formatErrorMessage, localized } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { localDateInput } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/expenses")({
  component: ExpensesPage,
});

function ExpensesPage() {
  const { role, user } = useAuth();
  const isOwner = role?.role === "owner";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    branch_id: role?.branch_id ?? "",
    description: "",
    amount: "",
    expense_date: localDateInput(),
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

  const {
    data: expenses = [],
    isPending: pagePending,
    error: pageError,
    refetch: retryPage,
  } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id, description, amount, expense_date, branches(name)")
        .order("expense_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.branch_id) throw new Error(t.chooseBranch);
      if (!form.description.trim()) throw new Error(t.requiredField);
      const amount = Number(form.amount);
      if (!form.amount || !Number.isFinite(amount) || amount < 0) throw new Error(t.invalidNumber);
      const { error } = await supabase.from("expenses").insert({
        ...form,
        description: form.description.trim(),
        amount,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.saved);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setOpen(false);
      setForm({ ...form, description: "", amount: "" });
    },
    onError: (e: Error) => toast.error(formatErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.deleted);
      qc.invalidateQueries({ queryKey: ["expenses"] });
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
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.expenses}</h1>
          <p className="text-sm text-muted-foreground">
            {localized("Andika ibisohoka by'ubucuruzi.", "Record business expenses.")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button disabled={branches.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> {t.add}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t.add} {t.expenses}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {isOwner && (
                <div className="space-y-2">
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
              <div className="space-y-2">
                <Label>{t.description} *</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.amount} *</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="Enter amount"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.expenseDate} *</Label>
                <Input
                  type="date"
                  value={form.expense_date}
                  onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
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

      <Card>
        <CardHeader />
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.date}</TableHead>
                <TableHead>{t.branch}</TableHead>
                <TableHead>{t.description}</TableHead>
                <TableHead>{t.amount}</TableHead>
                {isOwner && <TableHead className="text-right">{t.actions}</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{fmtDate(e.expense_date)}</TableCell>
                    <TableCell>{e.branches?.name}</TableCell>
                    <TableCell className="font-medium">{e.description}</TableCell>
                    <TableCell>{money(e.amount)}</TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(t.confirmDelete)) del.mutate(e.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
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
