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
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, Search, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { t, money, formatErrorMessage } from "@/lib/i18n";
import { useIsOwner } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/branches")({
  component: BranchesPage,
});

interface Branch {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  status: boolean;
  created_at: string;
}

function BranchesPage() {
  const isOwner = useIsOwner();

  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    status: true,
  });

  const {
    data: branches = [],
    isPending: pagePending,
    error: pageError,
    refetch: retryPage,
  } = useQuery({
    queryKey: ["branches"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name, phone, address, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data ?? []) as Branch[];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error(t.requiredField);
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("branches").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branches").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? t.updated : t.saved);
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-active"] });
      setOpen(false);
      setEditing(null);
      setForm({ name: "", phone: "", address: "", status: true });
    },
    onError: (e: Error) => toast.error(formatErrorMessage(e)),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("branches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.deleted);
      qc.invalidateQueries({ queryKey: ["branches"] });
      qc.invalidateQueries({ queryKey: ["branches-active"] });
    },
    onError: (e: Error) => toast.error(formatErrorMessage(e)),
  });

  const filtered = branches.filter(
    (b) =>
      (b.name?.toLowerCase() ?? "").includes(search.toLowerCase()) ||
      (b.address?.toLowerCase() ?? "").includes(search.toLowerCase()),
  );

  const openNew = () => {
    setEditing(null);
    setForm({ name: "", phone: "", address: "", status: true });
    setOpen(true);
  };
  const openEdit = (b: Branch) => {
    setEditing(b);
    setForm({ name: b.name, phone: b.phone ?? "", address: b.address ?? "", status: b.status });
    setOpen(true);
  };

  if (!isOwner) return <Navigate to="/dashboard" replace />;

  if (pagePending || pageError)
    return <QueryState pending={pagePending} error={pageError} retry={() => void retryPage()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.branches}</h1>
          <p className="text-sm text-muted-foreground">
            Kugabanya n'guhindura amashami y'ubucuruzi
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
                {editing ? t.edit : t.add} {t.branch}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t.name} *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t.phone}</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>{t.address}</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.status}
                  onCheckedChange={(v) => setForm({ ...form, status: v })}
                />
                <Label>{form.status ? t.active : t.inactive}</Label>
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
                <TableHead>{t.name}</TableHead>
                <TableHead>{t.phone}</TableHead>
                <TableHead>{t.address}</TableHead>
                <TableHead>{t.status}</TableHead>
                <TableHead className="text-right">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.phone ?? "—"}</TableCell>
                    <TableCell>{b.address ?? "—"}</TableCell>
                    <TableCell>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.status ? "bg-green-100/50 text-green-800" : "bg-red-100/50 text-red-800"}`}
                      >
                        {b.status ? t.active : t.inactive}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(t.confirmDelete)) del.mutate(b.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
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
