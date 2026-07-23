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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Trash2, Download, Upload, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, importFromExcel } from "@/lib/xlsx-utils";

export const Route = createFileRoute("/_authenticated/dividend")({
  component: DividendPage,
});

type PaymentStatus = "Pending" | "Paid" | "Partial";

interface Payable {
  id: string;
  company_id: string | null;
  client_id: string | null;
  shares_held: number | null;
  dividend_rate: number | null;
  gross_dividend: number | null;
  tax_amount: number | null;
  net_payable: number | null;
  payment_status: PaymentStatus;
  payment_date: string | null;
  payment_reference: string | null;
  fiscal_year: string | null;
  created_at: string;
}

const emptyForm = {
  company_id: "",
  client_id: "",
  shares_held: "",
  dividend_rate: "",
  gross_dividend: "",
  tax_amount: "",
  payment_status: "Pending" as PaymentStatus,
  payment_date: "",
  payment_reference: "",
  fiscal_year: "",
};

function DividendPage() {
  const { hasAny } = useAuth();
  const canWrite = hasAny(["admin", "finance_operator"]);
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [fyFilter, setFyFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<Payable | null>(null);
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editing, setEditing] = useState<Payable | null>(null);
  const [form, setForm] = useState(emptyForm);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, company_code, company_name").order("company_name");
      if (error) throw error;
      return data as { id: string; company_code: string; company_name: string }[];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, client_code, full_name, boid").order("full_name");
      if (error) throw error;
      return data as { id: string; client_code: string; full_name: string; boid: string | null }[];
    },
  });

  const companyMap = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, c])), [companies]);
  const clientMap = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c])), [clients]);
  const companyByCode = useMemo(() => Object.fromEntries(companies.map((c) => [c.company_code.toLowerCase(), c.id])), [companies]);
  const clientByCode = useMemo(() => Object.fromEntries(clients.map((c) => [c.client_code.toLowerCase(), c.id])), [clients]);
  const clientByBoid = useMemo(() => Object.fromEntries(clients.filter(c => c.boid).map((c) => [c.boid!.toLowerCase(), c.id])), [clients]);

  const { data = [], isLoading } = useQuery({
    queryKey: ["dividend_payables"],
    queryFn: async () => {
      const { data, error } = await supabase.from("dividend_payables").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Payable[];
    },
  });

  const fiscalYears = useMemo(() => Array.from(new Set(data.map((p) => p.fiscal_year).filter(Boolean))) as string[], [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return data.filter((p) => {
      if (statusFilter !== "all" && p.payment_status !== statusFilter) return false;
      if (companyFilter !== "all" && p.company_id !== companyFilter) return false;
      if (fyFilter !== "all" && p.fiscal_year !== fyFilter) return false;
      if (!q) return true;
      const c = p.company_id ? companyMap[p.company_id] : null;
      const cl = p.client_id ? clientMap[p.client_id] : null;
      return (
        (c?.company_name.toLowerCase().includes(q) ?? false) ||
        (c?.company_code.toLowerCase().includes(q) ?? false) ||
        (cl?.full_name.toLowerCase().includes(q) ?? false) ||
        (cl?.client_code.toLowerCase().includes(q) ?? false) ||
        (p.payment_reference ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, statusFilter, companyFilter, fyFilter, companyMap, clientMap]);

  const totals = useMemo(() => filtered.reduce(
    (a, p) => ({
      gross: a.gross + Number(p.gross_dividend ?? 0),
      tax: a.tax + Number(p.tax_amount ?? 0),
      net: a.net + Number(p.net_payable ?? 0),
    }),
    { gross: 0, tax: 0, net: 0 },
  ), [filtered]);

  const upsert = useMutation({
    mutationFn: async () => {
      const shares = form.shares_held ? Number(form.shares_held) : null;
      const rate = form.dividend_rate ? Number(form.dividend_rate) : null;
      const gross = form.gross_dividend ? Number(form.gross_dividend) : (shares != null && rate != null ? shares * rate : null);
      const payload = {
        company_id: form.company_id || null,
        client_id: form.client_id || null,
        shares_held: shares,
        dividend_rate: rate,
        gross_dividend: gross,
        tax_amount: form.tax_amount ? Number(form.tax_amount) : null,
        payment_status: form.payment_status,
        payment_date: form.payment_date || null,
        payment_reference: form.payment_reference || null,
        fiscal_year: form.fiscal_year || null,
      };
      if (editing) {
        const { error } = await supabase.from("dividend_payables").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dividend_payables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividend_payables"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast.success(editing ? "Payable updated" : "Payable created");
      setOpen(false); setEditing(null); setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dividend_payables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividend_payables"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast.success("Payable deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaid = useMutation({
    mutationFn: async () => {
      if (!payOpen) return;
      const { error } = await supabase
        .from("dividend_payables")
        .update({ payment_status: "Paid", payment_date: payDate || new Date().toISOString().slice(0, 10), payment_reference: payRef || null })
        .eq("id", payOpen.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dividend_payables"] });
      qc.invalidateQueries({ queryKey: ["dashboard-kpis"] });
      toast.success("Marked as paid");
      setPayOpen(null); setPayRef("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startNew = () => { setEditing(null); setForm(emptyForm); setOpen(true); };
  const startEdit = (p: Payable) => {
    setEditing(p);
    setForm({
      company_id: p.company_id ?? "",
      client_id: p.client_id ?? "",
      shares_held: p.shares_held?.toString() ?? "",
      dividend_rate: p.dividend_rate?.toString() ?? "",
      gross_dividend: p.gross_dividend?.toString() ?? "",
      tax_amount: p.tax_amount?.toString() ?? "",
      payment_status: p.payment_status,
      payment_date: p.payment_date ?? "",
      payment_reference: p.payment_reference ?? "",
      fiscal_year: p.fiscal_year ?? "",
    });
    setOpen(true);
  };

  const handleExport = () => {
    exportToExcel(
      filtered.map((p) => ({
        company_code: p.company_id ? companyMap[p.company_id]?.company_code : "",
        company_name: p.company_id ? companyMap[p.company_id]?.company_name : "",
        client_code: p.client_id ? clientMap[p.client_id]?.client_code : "",
        client_name: p.client_id ? clientMap[p.client_id]?.full_name : "",
        shares_held: p.shares_held,
        dividend_rate: p.dividend_rate,
        gross_dividend: p.gross_dividend,
        tax_amount: p.tax_amount,
        net_payable: p.net_payable,
        payment_status: p.payment_status,
        payment_date: p.payment_date,
        payment_reference: p.payment_reference,
        fiscal_year: p.fiscal_year,
      })),
      "dividend_payables",
    );
  };

  const handleImport = async (file: File) => {
    try {
      type Row = {
        company_code?: string; company_id?: string; client_code?: string; client_boid?: string; client_id?: string;
        shares_held?: number | string; dividend_rate?: number | string; gross_dividend?: number | string;
        tax_amount?: number | string; payment_status?: string; payment_date?: string; payment_reference?: string; fiscal_year?: string;
      };
      const rows = await importFromExcel<Row>(file);
      const clean: Record<string, unknown>[] = [];
      const errors: string[] = [];
      rows.forEach((r, i) => {
        const cid = r.company_id || (r.company_code ? companyByCode[String(r.company_code).toLowerCase()] : undefined);
        const clid = r.client_id || (r.client_code ? clientByCode[String(r.client_code).toLowerCase()] : undefined) || (r.client_boid ? clientByBoid[String(r.client_boid).toLowerCase()] : undefined);
        if (!cid || !clid) { errors.push(`Row ${i + 2}: company/client not found`); return; }
        const shares = r.shares_held != null ? Number(r.shares_held) : null;
        const rate = r.dividend_rate != null ? Number(r.dividend_rate) : null;
        const gross = r.gross_dividend != null ? Number(r.gross_dividend) : (shares != null && rate != null ? shares * rate : null);
        clean.push({
          company_id: cid,
          client_id: clid,
          shares_held: shares,
          dividend_rate: rate,
          gross_dividend: gross,
          tax_amount: r.tax_amount != null ? Number(r.tax_amount) : null,
          payment_status: (r.payment_status as PaymentStatus) ?? "Pending",
          payment_date: r.payment_date ?? null,
          payment_reference: r.payment_reference ?? null,
          fiscal_year: r.fiscal_year ?? null,
        });
      });
      if (!clean.length) return toast.error(errors[0] ?? "No valid rows");
      const { error } = await supabase.from("dividend_payables").insert(clean);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["dividend_payables"] });
      toast.success(`Imported ${clean.length} rows${errors.length ? ` (${errors.length} skipped)` : ""}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  const fmt = (n: number | null | undefined) => (n == null ? "—" : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const previewGross = form.gross_dividend
    ? Number(form.gross_dividend)
    : (Number(form.shares_held) || 0) * (Number(form.dividend_rate) || 0);

  return (
    <div>
      <PageHeader
        title="Stock Dividend Payables"
        description="Manage stock dividends with shares × rate calculation, grouped by fiscal year."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" /> Export
            </Button>
            {canWrite && (
              <>
                <input type="file" accept=".xlsx,.xls,.csv" ref={fileRef} className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = ""; }} />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" /> Import
                </Button>
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={startNew}>
                      <Plus className="mr-2 h-4 w-4" /> New Dividend
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editing ? "Edit Dividend Payable" : "New Dividend Payable"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label>Company *</Label>
                        <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                          <SelectContent>
                            {companies.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.company_code} — {c.company_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Client *</Label>
                        <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                          <SelectContent>
                            {clients.map((c) => (
                              <SelectItem key={c.id} value={c.id}>{c.client_code} — {c.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Shares Held</Label>
                        <Input type="number" step="0.01" value={form.shares_held} onChange={(e) => setForm({ ...form, shares_held: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Dividend Rate</Label>
                        <Input type="number" step="0.0001" value={form.dividend_rate} onChange={(e) => setForm({ ...form, dividend_rate: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Gross Dividend (override)</Label>
                        <Input type="number" step="0.01" placeholder={String(previewGross || "")} value={form.gross_dividend} onChange={(e) => setForm({ ...form, gross_dividend: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Tax Amount</Label>
                        <Input type="number" step="0.01" value={form.tax_amount} onChange={(e) => setForm({ ...form, tax_amount: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Net Payable (auto)</Label>
                        <Input readOnly value={fmt(previewGross - (Number(form.tax_amount) || 0))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Fiscal Year</Label>
                        <Input placeholder="2081/82" value={form.fiscal_year} onChange={(e) => setForm({ ...form, fiscal_year: e.target.value })} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Payment Status</Label>
                        <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v as PaymentStatus })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="Partial">Partial</SelectItem>
                            <SelectItem value="Paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Payment Date</Label>
                        <Input type="date" value={form.payment_date} onChange={(e) => setForm({ ...form, payment_date: e.target.value })} />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <Label>Payment Reference</Label>
                        <Input value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Cancel</Button>
                      <Button disabled={upsert.isPending || !form.company_id || !form.client_id} onClick={() => upsert.mutate()}>
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

      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gross Dividend</div><div className="text-xl font-semibold">{fmt(totals.gross)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tax</div><div className="text-xl font-semibold">{fmt(totals.tax)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net Payable</div><div className="text-xl font-semibold">{fmt(totals.net)}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            <Input placeholder="Search company, client, ref…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Partial">Partial</SelectItem>
                <SelectItem value="Paid">Paid</SelectItem>
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All companies</SelectItem>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.company_code} — {c.company_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={fyFilter} onValueChange={setFyFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All FY</SelectItem>
                {fiscalYears.map((fy) => <SelectItem key={fy} value={fy}>{fy}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead className="text-right">Shares</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Tax</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="py-8 text-center text-muted-foreground">No dividend payables.</TableCell></TableRow>
                ) : filtered.map((p) => {
                  const c = p.company_id ? companyMap[p.company_id] : null;
                  const cl = p.client_id ? clientMap[p.client_id] : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>{c ? <span><span className="font-mono text-xs text-muted-foreground">{c.company_code}</span> {c.company_name}</span> : "—"}</TableCell>
                      <TableCell>{cl ? <span><span className="font-mono text-xs text-muted-foreground">{cl.client_code}</span> {cl.full_name}</span> : "—"}</TableCell>
                      <TableCell className="text-right">{fmt(p.shares_held)}</TableCell>
                      <TableCell className="text-right">{fmt(p.dividend_rate)}</TableCell>
                      <TableCell className="text-right">{fmt(p.gross_dividend)}</TableCell>
                      <TableCell className="text-right">{fmt(p.tax_amount)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(p.net_payable)}</TableCell>
                      <TableCell className="text-xs">{p.fiscal_year ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={p.payment_status === "Paid" ? "default" : p.payment_status === "Partial" ? "secondary" : "outline"}>
                          {p.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-1">
                            {p.payment_status !== "Paid" && (
                              <Button size="icon" variant="ghost" onClick={() => { setPayOpen(p); setPayRef(p.payment_reference ?? ""); }} title="Mark paid">
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this payable?")) del.mutate(p.id); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!payOpen} onOpenChange={(o) => !o && setPayOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Mark as Paid</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Payment Date</Label>
              <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Reference</Label>
              <Input placeholder="Cheque / Txn no." value={payRef} onChange={(e) => setPayRef(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(null)}>Cancel</Button>
            <Button disabled={markPaid.isPending} onClick={() => markPaid.mutate()}>Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
