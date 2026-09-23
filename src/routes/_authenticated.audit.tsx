import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { t, fmtDateTime, numberFmt } from "@/lib/i18n";
import { useIsOwner } from "@/lib/auth-context";
import { QueryState } from "@/components/query-state";

export const Route = createFileRoute("/_authenticated/audit")({
  component: AuditPage,
});

function AuditPage() {
  const isOwner = useIsOwner();

  const {
    data: logs = [],
    error: logsError,
    isPending,
    refetch,
  } = useQuery({
    queryKey: ["audit-log"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select(
          "id, action, entity, entity_id, branch_id, user_id, created_at, details, branches(name)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const userIds = [
        ...new Set(
          (data ?? []).map((log) => log.user_id).filter((id): id is string => id !== null),
        ),
      ];
      if (userIds.length === 0) return (data ?? []).map((log) => ({ ...log, profile_name: null }));

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profilesError) throw profilesError;

      const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
      return (data ?? []).map((log) => ({
        ...log,
        profile_name: log.user_id ? (names.get(log.user_id) ?? null) : null,
      }));
    },
  });

  if (!isOwner) return <Navigate to="/dashboard" replace />;
  if (isPending || logsError)
    return <QueryState pending={isPending} error={logsError} retry={() => void refetch()} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{t.audit}</h1>
        <p className="text-sm text-muted-foreground">Review recorded activity by user.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity ({numberFmt(logs.length)})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t.date}</TableHead>
                  <TableHead>{t.actions}</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>{t.branch}</TableHead>
                  <TableHead>User</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                      {t.noData}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{fmtDateTime(log.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{log.entity}</TableCell>
                      <TableCell>{log.branches?.name ?? "—"}</TableCell>
                      <TableCell>{log.profile_name ?? log.user_id?.slice(0, 8) ?? "—"}</TableCell>
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
