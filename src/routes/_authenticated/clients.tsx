import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, importFromExcel } from "@/lib/xlsx-utils";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

type Holder = "Public" | "Promoter" | "Institution";
type Status = "Active" | "Inactive";

interface Client {
  id: string;
  client_code: string;
  full_name: string;
  boid: string | null;
  holder_type: Holder | null;
  pan_or_citizenship: string | null;
  bank_account_no: string | null;
  bank_name: string | null;
  status: Status;
  created_at: string;
}

const emptyForm = {
  client_code: "",
  full_name: "",
  boid: "",
  holder_type: "Public" as Holder,
  pan_or_citizenship: "",
  bank_account_no: "",
  bank_name: "",
  status: "Active" as Status,
};

function ClientsPage() {
  const { hasAny } = useAuth();
  const canWrite = hasAny(["admin", "finance_operator"]);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Client[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        !q ||
        c.full_name.toLowerCase().includes(q) ||
        c.client_code.toLowerCase().includes(q) ||
        (c.boid ?? "").toLowerCase().includes(q) ||
        (c.pan_or_citizenship ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = { ...form, boid: form.boid || null };
      if (editing) {
        const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast.success(editing ? "Client updated" : "Client created");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success("Client deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const startEdit = (c: Client) => {
    setEditing(c);
    setForm({
      client_code: c.client_code,
      full_name: c.full_name,
      boid: c.boid ?? "",
      holder_type: (c.holder_type ?? "Public") as Holder,
      pan_or_citizenship: c.pan_or_citizenship ?? "",
      bank_account_no: c.bank_account_no ?? "",
      bank_name: c.bank_name ?? "",
      status: c.status,
    });
    setOpen(true);
  };

  const handleExport = () =>
    exportToExcel(
      filtered.map((c) => ({
        client_code: c.client_code,
        full_name: c.full_name,
        boid: c.boid,
        holder_type: c.holder_type,
        pan_or_citizenship: c.pan_or_citizenship,
        bank_account_no: c.bank_account_no,
        bank_name: c.bank_name,
        status: c.status,
      })),
      "clients",
    );

  const handleImport = async (file: File) => {
    try {
      const rows = await importFromExcel<Partial<Client>>(file);
      const clean = rows
        .filter((r) => r.client_code && r.full_name)
        .map((r) => ({
          client_code: String(r.client_code),
          full_name: String(r.full_name),
          boid: r.boid ? String(r.boid) : null,
          holder_type: (r.holder_type as Holder) ?? null,
          pan_or_citizenship: r.pan_or_citizenship ? String(r.pan_or_citizenship) : null,
          bank_account_no: r.bank_account_no ? String(r.bank_account_no) : null,
          bank_name: r.bank_name ? String(r.bank_name) : null,
          status: (r.status as Status) ?? "Active",
        }));
      if (!clean.length) return toast.error("No valid rows found");
      const { error } = await supabase.from("clients").insert(clean);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Imported ${clean.length} clients`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Clients / Shareholders"
        description="Master list of shareholders and debenture holders (with BOID lookup)."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            {canWrite && (
              <>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  ref={fileRef}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImport(f);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Import
                </Button>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={startNew}>
                      <Plus className="mr-2 h-4 w-4" /> New Client
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editing ? "Edit Client" : "New Client"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Client Code *</Label>
                        <Input
                          value={form.client_code}
                          onChange={(e) => setForm({ ...form, client_code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Full Name *</Label>
                        <Input
                          value={form.full_name}
                          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>BOID</Label>
                        <Input
                          value={form.boid}
                          onChange={(e) => setForm({ ...form, boid: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Holder Type</Label>
                        <Select
                          value={form.holder_type}
                          onValueChange={(v) => setForm({ ...form, holder_type: v as Holder })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Public">Public</SelectItem>
                            <SelectItem value="Promoter">Promoter</SelectItem>
                            <SelectItem value="Institution">Institution</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>PAN / Citizenship</Label>
                        <Input
                          value={form.pan_or_citizenship}
                          onChange={(e) =>
                            setForm({ ...form, pan_or_citizenship: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bank Name</Label>
                        <Input
                          value={form.bank_name}
                          onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bank Account No.</Label>
                        <Input
                          value={form.bank_account_no}
                          onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select
                          value={form.status}
                          onValueChange={(v) => setForm({ ...form, status: v as Status })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setOpen(false);
                          setEditing(null);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        disabled={upsert.isPending || !form.client_code || !form.full_name}
                        onClick={() => upsert.mutate()}
                      >
                        {editing ? "Save changes" : "Create"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </>
            )}
          </>
        }
      />
      <Card>
        <CardContent className="p-4">
          <Input
            placeholder="Search by code, name, BOID, or PAN…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 max-w-sm"
          />
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>BOID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>PAN/Citizenship</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No clients yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.client_code}</TableCell>
                      <TableCell className="font-medium">{c.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{c.boid ?? "—"}</TableCell>
                      <TableCell>{c.holder_type ?? "—"}</TableCell>
                      <TableCell>{c.pan_or_citizenship ?? "—"}</TableCell>
                      <TableCell>{c.bank_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "Active" ? "default" : "secondary"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canWrite && (
                          <>
                            <Button size="icon" variant="ghost" onClick={() => startEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => {
                                if (confirm(`Delete ${c.full_name}?`)) del.mutate(c.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
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
