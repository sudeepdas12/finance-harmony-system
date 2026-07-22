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

export const Route = createFileRoute("/_authenticated/companies")({
  component: CompaniesPage,
});

type Sector = "Public" | "Private" | "Institution" | "Government" | "Other";
type TaxStatus = "Taxable" | "Exempted";
type Status = "Active" | "Inactive";

interface Company {
  id: string;
  company_code: string;
  company_name: string;
  sector_type: Sector | null;
  interest_tax_status: TaxStatus | null;
  pan_no: string | null;
  bank_account_no: string | null;
  bank_name: string | null;
  status: Status;
  created_at: string;
}

const emptyForm = {
  company_code: "",
  company_name: "",
  sector_type: "Public" as Sector,
  interest_tax_status: "Taxable" as TaxStatus,
  pan_no: "",
  bank_account_no: "",
  bank_name: "",
  status: "Active" as Status,
};

function CompaniesPage() {
  const { hasAny } = useAuth();
  const canWrite = hasAny(["admin", "finance_operator"]);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Company[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter(
      (c) =>
        !q ||
        c.company_name.toLowerCase().includes(q) ||
        c.company_code.toLowerCase().includes(q) ||
        (c.pan_no ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = { ...form };
      if (editing) {
        const { error } = await supabase.from("companies").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("companies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast.success(editing ? "Company updated" : "Company created");
      setOpen(false);
      setEditing(null);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast.success("Company deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const startEdit = (c: Company) => {
    setEditing(c);
    setForm({
      company_code: c.company_code,
      company_name: c.company_name,
      sector_type: (c.sector_type ?? "Public") as Sector,
      interest_tax_status: (c.interest_tax_status ?? "Taxable") as TaxStatus,
      pan_no: c.pan_no ?? "",
      bank_account_no: c.bank_account_no ?? "",
      bank_name: c.bank_name ?? "",
      status: c.status,
    });
    setOpen(true);
  };

  const handleExport = () => {
    exportToExcel(
      filtered.map((c) => ({
        company_code: c.company_code,
        company_name: c.company_name,
        sector_type: c.sector_type,
        interest_tax_status: c.interest_tax_status,
        pan_no: c.pan_no,
        bank_account_no: c.bank_account_no,
        bank_name: c.bank_name,
        status: c.status,
      })),
      "companies",
    );
  };

  const handleImport = async (file: File) => {
    try {
      const rows = await importFromExcel<Partial<Company>>(file);
      const clean = rows
        .filter((r) => r.company_code && r.company_name)
        .map((r) => ({
          company_code: String(r.company_code),
          company_name: String(r.company_name),
          sector_type: (r.sector_type as Sector) ?? null,
          interest_tax_status: (r.interest_tax_status as TaxStatus) ?? null,
          pan_no: r.pan_no ? String(r.pan_no) : null,
          bank_account_no: r.bank_account_no ? String(r.bank_account_no) : null,
          bank_name: r.bank_name ? String(r.bank_name) : null,
          status: (r.status as Status) ?? "Active",
        }));
      if (!clean.length) return toast.error("No valid rows found");
      const { error } = await supabase.from("companies").insert(clean);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success(`Imported ${clean.length} companies`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Master list of issuing companies (debentures & stocks)."
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
                      <Plus className="mr-2 h-4 w-4" /> New Company
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editing ? "Edit Company" : "New Company"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Company Code *</Label>
                        <Input
                          value={form.company_code}
                          onChange={(e) => setForm({ ...form, company_code: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Company Name *</Label>
                        <Input
                          value={form.company_name}
                          onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Sector</Label>
                        <Select
                          value={form.sector_type}
                          onValueChange={(v) => setForm({ ...form, sector_type: v as Sector })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {["Public", "Private", "Institution", "Government", "Other"].map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Interest Tax Status</Label>
                        <Select
                          value={form.interest_tax_status}
                          onValueChange={(v) =>
                            setForm({ ...form, interest_tax_status: v as TaxStatus })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Taxable">Taxable</SelectItem>
                            <SelectItem value="Exempted">Exempted</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>PAN No.</Label>
                        <Input
                          value={form.pan_no}
                          onChange={(e) => setForm({ ...form, pan_no: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Bank Name</Label>
                        <Input
                          value={form.bank_name}
                          onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
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
                        disabled={
                          upsert.isPending || !form.company_code || !form.company_name
                        }
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
            placeholder="Search by code, name, or PAN…"
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
                  <TableHead>Sector</TableHead>
                  <TableHead>Tax</TableHead>
                  <TableHead>PAN</TableHead>
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
                      No companies yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs">{c.company_code}</TableCell>
                      <TableCell className="font-medium">{c.company_name}</TableCell>
                      <TableCell>{c.sector_type ?? "—"}</TableCell>
                      <TableCell>{c.interest_tax_status ?? "—"}</TableCell>
                      <TableCell>{c.pan_no ?? "—"}</TableCell>
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
                                if (confirm(`Delete ${c.company_name}?`)) del.mutate(c.id);
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
