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
type Residency = "Resident" | "Non-Resident";
type Verification = "Pending" | "Verified" | "Rejected";

interface Client {
  id: string;
  client_code: string;
  client_id: string | null;
  full_name: string;
  father_name: string | null;
  grandfather_name: string | null;
  boid: string | null;
  holder_type: Holder | null;
  pan_or_citizenship: string | null;
  address: string | null;
  province: string | null;
  district: string | null;
  municipality: string | null;
  phone: string | null;
  email: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  bank_account_no: string | null;
  account_type: string | null;
  residency: Residency | null;
  verification_status: Verification;
  status: Status;
  created_at: string;
}

const emptyForm = {
  client_code: "",
  client_id: "",
  full_name: "",
  father_name: "",
  grandfather_name: "",
  boid: "",
  holder_type: "Public" as Holder,
  pan_or_citizenship: "",
  address: "",
  province: "",
  district: "",
  municipality: "",
  phone: "",
  email: "",
  bank_name: "",
  bank_branch: "",
  bank_account_no: "",
  account_type: "",
  residency: "Resident" as Residency,
  verification_status: "Pending" as Verification,
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
        (c.client_id ?? "").toLowerCase().includes(q) ||
        (c.boid ?? "").toLowerCase().includes(q) ||
        (c.pan_or_citizenship ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const setF = (k: keyof typeof form, v: string) => setForm({ ...form, [k]: v });

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        client_code: form.client_code,
        client_id: form.client_id || null,
        full_name: form.full_name,
        father_name: form.father_name || null,
        grandfather_name: form.grandfather_name || null,
        boid: form.boid || null,
        holder_type: form.holder_type,
        pan_or_citizenship: form.pan_or_citizenship || null,
        address: form.address || null,
        province: form.province || null,
        district: form.district || null,
        municipality: form.municipality || null,
        phone: form.phone || null,
        email: form.email || null,
        bank_name: form.bank_name || null,
        bank_branch: form.bank_branch || null,
        bank_account_no: form.bank_account_no || null,
        account_type: form.account_type || null,
        residency: form.residency,
        verification_status: form.verification_status,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("clients").update(payload as never).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clients").insert(payload as never);
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
      client_id: c.client_id ?? "",
      full_name: c.full_name,
      father_name: c.father_name ?? "",
      grandfather_name: c.grandfather_name ?? "",
      boid: c.boid ?? "",
      holder_type: (c.holder_type ?? "Public") as Holder,
      pan_or_citizenship: c.pan_or_citizenship ?? "",
      address: c.address ?? "",
      province: c.province ?? "",
      district: c.district ?? "",
      municipality: c.municipality ?? "",
      phone: c.phone ?? "",
      email: c.email ?? "",
      bank_name: c.bank_name ?? "",
      bank_branch: c.bank_branch ?? "",
      bank_account_no: c.bank_account_no ?? "",
      account_type: c.account_type ?? "",
      residency: (c.residency ?? "Resident") as Residency,
      verification_status: c.verification_status ?? "Pending",
      status: c.status,
    });
    setOpen(true);
  };

  const handleExport = () =>
    exportToExcel(filtered as unknown as Record<string, unknown>[], "clients");

  const handleImport = async (file: File) => {
    try {
      const rows = await importFromExcel<Record<string, unknown>>(file);
      const clean = rows
        .filter((r) => r.client_code && r.full_name)
        .map((r) => ({
          client_code: String(r.client_code),
          client_id: r.client_id ? String(r.client_id) : null,
          full_name: String(r.full_name),
          father_name: r.father_name ? String(r.father_name) : null,
          grandfather_name: r.grandfather_name ? String(r.grandfather_name) : null,
          boid: r.boid ? String(r.boid) : null,
          holder_type: (r.holder_type as Holder) ?? null,
          pan_or_citizenship: r.pan_or_citizenship ? String(r.pan_or_citizenship) : null,
          address: r.address ? String(r.address) : null,
          province: r.province ? String(r.province) : null,
          district: r.district ? String(r.district) : null,
          municipality: r.municipality ? String(r.municipality) : null,
          phone: r.phone ? String(r.phone) : null,
          email: r.email ? String(r.email) : null,
          bank_name: r.bank_name ? String(r.bank_name) : null,
          bank_branch: r.bank_branch ? String(r.bank_branch) : null,
          bank_account_no: r.bank_account_no ? String(r.bank_account_no) : null,
          account_type: r.account_type ? String(r.account_type) : null,
          residency: (r.residency as Residency) ?? null,
          verification_status: (r.verification_status as Verification) ?? "Pending",
          status: (r.status as Status) ?? "Active",
        }));
      if (!clean.length) return toast.error("No valid rows found");
      const { error } = await supabase.from("clients").insert(clean as never);
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
        description="Master list of shareholders and debenture holders with KYC, address, bank & verification."
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
                  <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{editing ? "Edit Client" : "New Client"}</DialogTitle>
                    </DialogHeader>

                    <div className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Identity
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Client Code *</Label>
                        <Input value={form.client_code} onChange={(e) => setF("client_code", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Client ID</Label>
                        <Input value={form.client_id} onChange={(e) => setF("client_id", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>BOID</Label>
                        <Input value={form.boid} onChange={(e) => setF("boid", e.target.value)} />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Full Name *</Label>
                        <Input value={form.full_name} onChange={(e) => setF("full_name", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Holder Type</Label>
                        <Select value={form.holder_type} onValueChange={(v) => setF("holder_type", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Public">Public</SelectItem>
                            <SelectItem value="Promoter">Promoter</SelectItem>
                            <SelectItem value="Institution">Institution</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Father's Name</Label>
                        <Input value={form.father_name} onChange={(e) => setF("father_name", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Grandfather's Name</Label>
                        <Input value={form.grandfather_name} onChange={(e) => setF("grandfather_name", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>PAN / Citizenship</Label>
                        <Input value={form.pan_or_citizenship} onChange={(e) => setF("pan_or_citizenship", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Residency</Label>
                        <Select value={form.residency} onValueChange={(v) => setF("residency", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Resident">Resident</SelectItem>
                            <SelectItem value="Non-Resident">Non-Resident</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Address & Contact
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5 md:col-span-3">
                        <Label>Address</Label>
                        <Input value={form.address} onChange={(e) => setF("address", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Province</Label>
                        <Input value={form.province} onChange={(e) => setF("province", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>District</Label>
                        <Input value={form.district} onChange={(e) => setF("district", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Municipality / VDC</Label>
                        <Input value={form.municipality} onChange={(e) => setF("municipality", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone</Label>
                        <Input value={form.phone} onChange={(e) => setF("phone", e.target.value)} />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Email</Label>
                        <Input type="email" value={form.email} onChange={(e) => setF("email", e.target.value)} />
                      </div>
                    </div>

                    <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Bank
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label>Bank Name</Label>
                        <Input value={form.bank_name} onChange={(e) => setF("bank_name", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Branch</Label>
                        <Input value={form.bank_branch} onChange={(e) => setF("bank_branch", e.target.value)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Account Type</Label>
                        <Input placeholder="Saving / Current" value={form.account_type} onChange={(e) => setF("account_type", e.target.value)} />
                      </div>
                      <div className="space-y-1.5 md:col-span-3">
                        <Label>Account Number</Label>
                        <Input value={form.bank_account_no} onChange={(e) => setF("bank_account_no", e.target.value)} />
                      </div>
                    </div>

                    <div className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Status
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Verification</Label>
                        <Select value={form.verification_status} onValueChange={(v) => setF("verification_status", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Verified">Verified</SelectItem>
                            <SelectItem value="Rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Status</Label>
                        <Select value={form.status} onValueChange={(v) => setF("status", v)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <DialogFooter className="mt-4">
                      <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>
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
            placeholder="Search by code, name, ID, BOID, or PAN…"
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
                  <TableHead>PAN</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
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
                      <TableCell>{c.phone ?? "—"}</TableCell>
                      <TableCell>{c.bank_name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            c.verification_status === "Verified"
                              ? "default"
                              : c.verification_status === "Rejected"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {c.verification_status}
                        </Badge>
                      </TableCell>
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
