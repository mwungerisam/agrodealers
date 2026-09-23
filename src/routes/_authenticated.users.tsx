import { QueryState } from "@/components/query-state";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { t, formatErrorMessage, localized } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { isStrongPassword } from "@/lib/password-policy";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";

type UserRow = {
  id: string;
  user_id: string;
  role: "owner" | "manager";
  branch_id: string | null;
  is_primary_owner?: boolean;
  profile?: { id: string; full_name: string; phone: string | null };
};

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  const { role } = useAuth();
  const canManageRoles = role?.is_primary_owner === true;

  const qc = useQueryClient();
  const [removing, setRemoving] = useState<UserRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [showInitialPassword, setShowInitialPassword] = useState(false);
  const [worker, setWorker] = useState({
    fullName: "",
    email: "",
    phone: "",
    branchId: "",
    initialPassword: "",
  });
  const passwordIsStrong = isStrongPassword(worker.initialPassword);
  const canCreateWorker = Boolean(
    worker.fullName.trim() && worker.email.trim() && worker.branchId && passwordIsStrong,
  );

  const {
    data: rows = [],
    isPending: pagePending,
    error: pageError,
    refetch: retryPage,
  } = useQuery({
    queryKey: ["user-roles-list"],
    queryFn: async () => {
      const { data: roles = [], error: rolesError } = await supabase
        .from("user_roles")
        .select("id, user_id, role, branch_id, is_primary_owner")
        .order("created_at");
      if (rolesError) throw rolesError;
      const { data: profiles = [], error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, phone");
      if (profilesError) throw profilesError;

      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r]));
      const list: UserRow[] = (roles ?? []).map((r) => ({
        ...r,
        profile: profiles?.find((p) => p.id === r.user_id),
      }));

      (profiles ?? []).forEach((p) => {
        if (!roleMap.has(p.id)) {
          list.push({
            id: `new-${p.id}`,
            user_id: p.id,
            role: "manager",
            branch_id: null,
            profile: p,
          });
        }
      });

      return list;
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ["branches-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateRow = useMutation({
    mutationFn: async (v: {
      id: string;
      user_id?: string;
      role: "owner" | "manager";
      branch_id: string | null;
    }) => {
      if (v.id.startsWith("new-") && v.user_id) {
        const { error } = await supabase.from("user_roles").insert({
          user_id: v.user_id,
          role: v.role,
          branch_id: v.branch_id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: v.role, branch_id: v.branch_id })
          .eq("id", v.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t.updated);
      qc.invalidateQueries({ queryKey: ["user-roles-list"] });
    },
    onError: (e: Error) => toast.error(formatErrorMessage(e)),
  });

  const removeWorker = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc("delete_worker", { p_user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t.workerRemoved);
      setRemoving(null);
      qc.invalidateQueries({ queryKey: ["user-roles-list"] });
    },
    onError: (error: Error) => toast.error(formatErrorMessage(error)),
  });

  const inviteWorker = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("create-worker", { body: worker });
      if (error) {
        // Edge Functions return their useful validation/authentication message in
        // the response body; surface it instead of a generic HTTP-status toast.
        const context = (error as { context?: unknown }).context;
        if (context && typeof context === "object") {
          const json = (context as { json?: unknown }).json;
          if (typeof json === "function") {
            const payload = await (json as () => Promise<unknown>).call(context).catch(() => null);
            if (
              payload &&
              typeof payload === "object" &&
              "error" in payload &&
              typeof payload.error === "string"
            ) {
              throw new Error(payload.error);
            }
          }

          // Some Supabase client versions expose the parsed function error
          // directly instead of a Fetch Response.
          if ("error" in context && typeof context.error === "string") {
            throw new Error(context.error);
          }
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success(t.workerCreated);
      setWorker({ fullName: "", email: "", phone: "", branchId: "", initialPassword: "" });
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["user-roles-list"] });
    },
    onError: (error: Error) => toast.error(formatErrorMessage(error)),
  });

  if (role && role.role !== "owner") return <Navigate to="/dashboard" replace />;

  if (pagePending || pageError)
    return <QueryState pending={pagePending} error={pageError} retry={() => void retryPage()} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.users}</h1>
          <p className="text-sm text-muted-foreground">
            {localized(
              "Cunga abakoresha, inshingano zabo n'amashami bakoreramo.",
              "Manage users, their roles, and their branch assignments.",
            )}
          </p>
        </div>
        <Button onClick={() => setAdding(true)} disabled={!canManageRoles}>
          <Plus className="mr-2 h-4 w-4" />
          {t.addWorker}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {localized(`Abakoresha bose (${rows.length})`, `All users (${rows.length})`)}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {localized(
              "Umuyobozi ni we ushyiraho konti z'abakozi kandi akabagenera uruhare n'ishami.",
              "The owner creates worker accounts and assigns their role and branch.",
            )}
          </p>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.fullName}</TableHead>
                <TableHead>{t.phone}</TableHead>
                <TableHead>{t.role}</TableHead>
                <TableHead>{t.branch}</TableHead>
                <TableHead className="w-16 text-right">{t.actions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                    {t.noData}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.profile?.full_name || "—"}</TableCell>
                    <TableCell>{r.profile?.phone || "—"}</TableCell>
                    <TableCell>
                      <Select
                        value={r.role}
                        disabled={!canManageRoles || r.is_primary_owner || updateRow.isPending}
                        onValueChange={(v) =>
                          updateRow.mutate({
                            id: r.id,
                            user_id: r.user_id,
                            role: v as UserRow["role"],
                            branch_id: r.branch_id,
                          })
                        }
                      >
                        <SelectTrigger className="w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">{t.owner}</SelectItem>
                          <SelectItem value="manager">{t.manager}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={r.branch_id ?? "none"}
                        onValueChange={(v) =>
                          updateRow.mutate({
                            id: r.id,
                            user_id: r.user_id,
                            role: r.role,
                            branch_id: v === "none" ? null : v,
                          })
                        }
                        disabled={!canManageRoles || r.role === "owner" || updateRow.isPending}
                      >
                        <SelectTrigger className="w-52">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">—</SelectItem>
                          {branches.map((b) => (
                            <SelectItem key={b.id} value={b.id}>
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {r.role === "manager" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setRemoving(r)}
                          aria-label={t.removeWorker}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog
        open={adding}
        onOpenChange={(open) => {
          setAdding(open);
          if (!open) setShowInitialPassword(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.createWorker}</DialogTitle>
            <DialogDescription>{t.workerCreationDesc}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (canCreateWorker) inviteWorker.mutate();
            }}
          >
            <div className="space-y-1">
              <Label htmlFor="worker-name">{t.fullName}</Label>
              <Input
                id="worker-name"
                value={worker.fullName}
                onChange={(e) => setWorker({ ...worker, fullName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="worker-email">{t.email}</Label>
              <Input
                id="worker-email"
                type="email"
                value={worker.email}
                onChange={(e) => setWorker({ ...worker, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="worker-phone">{t.phone}</Label>
              <Input
                id="worker-phone"
                value={worker.phone}
                onChange={(e) => setWorker({ ...worker, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="worker-password">{t.initialPassword}</Label>
              <div className="relative">
                <Input
                  id="worker-password"
                  type={showInitialPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={12}
                  required
                  value={worker.initialPassword}
                  onChange={(e) => setWorker({ ...worker, initialPassword: e.target.value })}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowInitialPassword((visible) => !visible)}
                  className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={
                    showInitialPassword ? "Hide initial password" : "Show initial password"
                  }
                  aria-pressed={showInitialPassword}
                >
                  {showInitialPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p
                className={
                  passwordIsStrong || !worker.initialPassword
                    ? "text-xs text-muted-foreground"
                    : "text-xs text-destructive"
                }
              >
                {localized(
                  "Koresha nibura inyuguti 12 zirimo inyuguti nto n'inkuru, umubare n'ikimenyetso.",
                  "Use at least 12 characters, including upper- and lower-case letters, a number, and a symbol.",
                )}
              </p>
            </div>
            <div className="space-y-1">
              <Label>{t.branch}</Label>
              <Select
                value={worker.branchId}
                onValueChange={(branchId) => setWorker({ ...worker, branchId })}
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
            <DialogFooter>
              <Button type="submit" disabled={!canCreateWorker || inviteWorker.isPending}>
                {inviteWorker.isPending ? t.loading : t.createWorker}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.removeWorkerTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.removeWorkerDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => removing && removeWorker.mutate(removing.user_id)}
            >
              {removeWorker.isPending ? t.loading : t.removeWorker}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
