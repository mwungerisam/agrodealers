import { QueryState } from "@/components/query-state";
import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Pencil, Trash2, Search, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { t, formatErrorMessage } from "@/lib/i18n";
import { useIsOwner, useBranchId, useAuth } from "@/lib/auth-context";
import { SetupBanner } from "@/components/setup-banner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

interface Customer {
  id: string;
  branch_id: string;
  name: string;
  phone: string | null;
  created_at: string;
  branches?: { name: string };
}

function CustomersPage() {
  const isOwner = useIsOwner();
  const workerBranchId = useBranchId();
  const { user } = useAuth();

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState({
    branch_id: "",
    name: "",
    phone: "",
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
    data: customers = [],
    isPending: pagePending,
    error: pageError,
    refetch: retryPage,
  } = useQuery({
    queryKey: ["customers"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, branch_id, name, phone, created_at, branches(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Customer[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error(t.requiredField);
      const branchId = isOwner ? form.branch_id : workerBranchId;
      if (!branchId) throw new Error(t.chooseBranch);
      if (editing) {
        const { error } = await supabase
          .from("customers")
          .update({ name: form.name.trim(), phone: form.phone.trim() || null, branch_id: branchId })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert({
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          branch_id: branchId,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? t.updated : t.saved);
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["branches-active"] });
      setOpen(false);
      setEditing(null);
      setForm({ branch_id: isOwner ? "" : (workerBranchId ?? ""), name: "", phone: "" });
    },
    onError: (e: Error) => toast.error(formatErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.deleted);
      qc.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (e: Error) => toast.error(formatErrorMessage(e)),
  });

  const filtered = customers.filter(
    (c) =>
      c.name?.toLowerCase().includes(search.toLowerCase()) ||
      (c.phone?.toLowerCase() ?? "").includes(search.toLowerCase()),
  );

  const openNew = () => {
    setEditing(null);
    setForm({ branch_id: isOwner ? "" : (workerBranchId ?? ""), name: "", phone: "" });
    setOpen(true);
  };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ branch_id: c.branch_id, name: c.name, phone: c.phone ?? "" });
    setOpen(true);
  };

  if (pagePending || pageError)
    return <QueryState pending={pagePending} error={pageError} retry={() => void retryPage()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.customers}</h1>
          <p className="text-sm text-muted-foreground">
            Kugabanya n'guhindura abakiriya babarakora
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> {t.add}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? t.edit : t.add} {t.customer}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                {isOwner && (
                  <>
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
                  </>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t.customerName} *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.customerPhone}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
        <CardHeader>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.customerName}</TableHead>
                <TableHead>{t.customerPhone}</TableHead>
                <TableHead>{t.branch}</TableHead>
                <TableHead>{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    {branches.length === 0
                      ? "Banza wongereho ishami muri Amashami mbere yo guhindura abakiriya."
                      : t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.phone ?? "—"}</TableCell>
                    <TableCell>{c.branches?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {isOwner && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(c)}
                            aria-label={t.edit}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(t.confirmDelete)) del.mutate(c.id);
                            }}
                            aria-label={t.delete}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </TableCell>
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
