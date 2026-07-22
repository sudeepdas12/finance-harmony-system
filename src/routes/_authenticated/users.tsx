import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { UserCog, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

const ALL_ROLES: AppRole[] = [
  "admin",
  "finance_operator",
  "reconciliation_officer",
  "auditor",
  "report_viewer",
];

interface ProfileRow {
  id: string;
  full_name: string | null;
  email: string | null;
  created_at: string;
  roles: AppRole[];
}

function UsersPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<ProfileRow | null>(null);
  const [selected, setSelected] = useState<Set<AppRole>>(new Set());
  const [search, setSearch] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["users-and-roles"],
    queryFn: async () => {
      const [profiles, roles] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, created_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (profiles.error) throw profiles.error;
      if (roles.error) throw roles.error;
      const byUser = new Map<string, AppRole[]>();
      for (const r of (roles.data ?? []) as { user_id: string; role: AppRole }[]) {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role);
        byUser.set(r.user_id, arr);
      }
      return (profiles.data ?? []).map((p) => ({
        ...(p as Omit<ProfileRow, "roles">),
        roles: byUser.get((p as { id: string }).id) ?? [],
      })) as ProfileRow[];
    },
    enabled: isAdmin,
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      const current = new Set(editing.roles);
      const toAdd = [...selected].filter((r) => !current.has(r));
      const toRemove = [...current].filter((r) => !selected.has(r));
      if (toRemove.length) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", editing.id)
          .in("role", toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase
          .from("user_roles")
          .insert(toAdd.map((role) => ({ user_id: editing.id, role })));
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users-and-roles"] });
      toast.success("Roles updated");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (p: ProfileRow) => {
    setEditing(p);
    setSelected(new Set(p.roles));
  };

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Users & Roles" description="Admin only." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <ShieldAlert className="h-10 w-10 text-destructive" />
            <h3 className="text-lg font-semibold">Access denied</h3>
            <p className="max-w-md text-sm text-muted-foreground">
              You need the admin role to view or manage users.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtered = data.filter((u) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.full_name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        description="Assign admin, finance, reconciliation, auditor, and viewer roles."
      />
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-sm"
          />
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No users yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                      <TableCell>{u.email ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {u.roles.length === 0 && (
                            <span className="text-xs text-muted-foreground">No roles</span>
                          )}
                          {u.roles.map((r) => (
                            <Badge key={r} variant="secondary" className="capitalize">
                              {r.replace("_", " ")}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(u.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => openEdit(u)}>
                          <UserCog className="mr-2 h-4 w-4" /> Manage
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage roles — {editing?.full_name ?? editing?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {ALL_ROLES.map((r) => (
              <label key={r} className="flex items-center gap-3 rounded-md border p-3">
                <Checkbox
                  checked={selected.has(r)}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(r);
                    else next.delete(r);
                    setSelected(next);
                  }}
                />
                <div>
                  <div className="text-sm font-medium capitalize">{r.replace("_", " ")}</div>
                  <div className="text-xs text-muted-foreground">
                    {roleDescription(r)}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function roleDescription(r: AppRole) {
  switch (r) {
    case "admin":
      return "Full access to all modules and user management.";
    case "finance_operator":
      return "Create and edit master data and payables.";
    case "reconciliation_officer":
      return "Reconcile bank transactions and IAF allocations.";
    case "auditor":
      return "Read-only access to all data and audit logs.";
    case "report_viewer":
      return "View reports and dashboards.";
  }
}
