import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Upload, Download, Link2, Unlink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { exportToExcel, importFromExcel } from "@/lib/xlsx-utils";

export const Route = createFileRoute("/_authenticated/reconciliation")({
  component: ReconciliationPage,
});

type Txn = {
  id: string;
  transaction_date: string;
  amount: number;
  reference: string | null;
  description: string | null;
  bank_account_no: string | null;
  is_reconciled: boolean;
  matched_payable_id: string | null;
  matched_payable_type: string | null;
};

function ReconciliationPage() {
  const qc = useQueryClient();
  const { hasAny } = useAuth();
  const canWrite = hasAny(["admin", "reconciliation_officer", "finance_operator"]);
  const [filter, setFilter] = useState<"all" | "unmatched" | "matched">("all");
  const [open, setOpen] = useState(false);
  const [matchOpen, setMatchOpen] = useState<Txn | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    transaction_date: "", amount: "", reference: "", description: "", bank_account_no: "",
  });

  const { data: txns = [] } = useQuery({
    queryKey: ["bank_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("bank_transactions").select("*").order("transaction_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Txn[];
    },
  });

  const filtered = useMemo(
    () => txns.filter((t) => filter === "all" || (filter === "matched" ? t.is_reconciled : !t.is_reconciled)),
    [txns, filter],
  );

  const totals = useMemo(() => {
    const matched = txns.filter((t) => t.is_reconciled);
    return {
      total: txns.length,
      matched: matched.length,
      unmatched: txns.length - matched.length,
      amount: txns.reduce((s, t) => s + Number(t.amount || 0), 0),
    };
  }, [txns]);

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("bank_transactions").insert({
        transaction_date: form.transaction_date,
        amount: Number(form.amount),
        reference: form.reference || null,
        description: form.description || null,
        bank_account_no: form.bank_account_no || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transaction added");
      setOpen(false);
      setForm({ transaction_date: "", amount: "", reference: "", description: "", bank_account_no: "" });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_transactions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
    },
  });

  const unmatch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_transactions")
        .update({ is_reconciled: false, matched_payable_id: null, matched_payable_type: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unmatched");
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
    },
  });

  const onImport = async (file: File) => {
    try {
      const rows = await importFromExcel<Record<string, unknown>>(file);
      const inserts = rows.map((r) => ({
        transaction_date: String(r.transaction_date ?? r.date ?? "").slice(0, 10),
        amount: Number(r.amount ?? 0),
        reference: (r.reference as string) ?? null,
        description: (r.description as string) ?? null,
        bank_account_no: (r.bank_account_no as string) ?? null,
      })).filter((r) => r.transaction_date && !isNaN(r.amount));
      if (!inserts.length) { toast.error("No valid rows found"); return; }
      const { error } = await supabase.from("bank_transactions").insert(inserts);
      if (error) throw error;
      toast.success(`Imported ${inserts.length} transactions`);
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    }
  };

  const onExport = () => {
    exportToExcel(
      txns.map((t) => ({
        transaction_date: t.transaction_date,
        amount: t.amount,
        reference: t.reference,
        description: t.description,
        bank_account_no: t.bank_account_no,
        matched: t.is_reconciled ? "Yes" : "No",
        matched_type: t.matched_payable_type,
      })),
      "bank_transactions",
    );
  };

  return (
    <div>
      <PageHeader
        title="Bank Reconciliation"
        description="Upload bank statements, auto-match against payables, and reconcile."
        actions={
          canWrite && (
            <>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = ""; }} />
              <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Import</Button>
              <Button variant="outline" onClick={onExport}><Download className="mr-2 h-4 w-4" />Export</Button>
              <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Transaction</Button>
            </>
          )
        }
      />

      <div className="mb-4 grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Transactions</div><div className="text-2xl font-semibold">{totals.total}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Matched</div><div className="text-2xl font-semibold text-emerald-600">{totals.matched}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Unmatched</div><div className="text-2xl font-semibold text-amber-600">{totals.unmatched}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Total Value</div><div className="text-2xl font-semibold">{totals.amount.toLocaleString()}</div></CardContent></Card>
      </div>

      <div className="mb-4 flex gap-2">
        <Select value={filter} onValueChange={(v: "all" | "unmatched" | "matched") => setFilter(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unmatched">Unmatched only</SelectItem>
            <SelectItem value="matched">Matched only</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Reference</TableHead>
            <TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">No transactions</TableCell></TableRow>}
            {filtered.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.transaction_date}</TableCell>
                <TableCell className="font-medium">{Number(t.amount).toLocaleString()}</TableCell>
                <TableCell>{t.reference}</TableCell>
                <TableCell className="max-w-xs truncate">{t.description}</TableCell>
                <TableCell>
                  {t.is_reconciled
                    ? <Badge>Matched · {t.matched_payable_type ?? ""}</Badge>
                    : <Badge variant="secondary">Unmatched</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  {canWrite && (
                    <>
                      {t.is_reconciled
                        ? <Button size="sm" variant="ghost" onClick={() => unmatch.mutate(t.id)}><Unlink className="h-4 w-4" /></Button>
                        : <Button size="sm" variant="ghost" onClick={() => setMatchOpen(t)}><Link2 className="h-4 w-4" /></Button>}
                      <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)}><Trash2 className="h-4 w-4" /></Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Bank Transaction</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <div><Label>Date</Label><Input type="date" value={form.transaction_date} onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} /></div>
            <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Bank A/C No</Label><Input value={form.bank_account_no} onChange={(e) => setForm({ ...form, bank_account_no: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => create.mutate()} disabled={!form.transaction_date || !form.amount}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MatchDialog txn={matchOpen} onClose={() => setMatchOpen(null)} onDone={() => qc.invalidateQueries({ queryKey: ["bank_transactions"] })} />
    </div>
  );
}

function MatchDialog({ txn, onClose, onDone }: { txn: Txn | null; onClose: () => void; onDone: () => void }) {
  const [type, setType] = useState<"interest" | "dividend">("interest");
  const { data: candidates = [] } = useQuery({
    queryKey: ["match-candidates", type, txn?.amount],
    queryFn: async () => {
      if (!txn) return [];
      const q = type === "interest"
        ? supabase.from("interest_payables").select("id, net_payable, due_date, payment_reference").eq("payment_status", "Pending").order("due_date")
        : supabase.from("dividend_payables").select("id, net_payable, due_date, payment_reference").eq("payment_status", "Pending").order("due_date");
      const { data } = await q;
      return (data ?? []) as unknown as { id: string; net_payable: number | null; due_date: string; payment_reference: string | null }[];
    },
    enabled: !!txn,
  });

  const suggestion = useMemo(() => {
    if (!txn) return null;
    return candidates.find((c) => Math.abs(Number(c.net_payable ?? 0) - Number(txn.amount)) < 0.01) ?? null;
  }, [candidates, txn]);

  const doMatch = async (payableId: string) => {
    if (!txn) return;
    const table = type === "interest" ? "interest_payables" : "dividend_payables";
    const { error: e1 } = await supabase.from(table)
      .update({ payment_status: "Paid", payment_date: txn.transaction_date, payment_reference: txn.reference }).eq("id", payableId);
    if (e1) { toast.error(e1.message); return; }
    const { error: e2 } = await supabase.from("bank_transactions")
      .update({ is_reconciled: true, matched_payable_id: payableId, matched_payable_type: type }).eq("id", txn.id);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Matched & marked as paid");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!txn} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Match Transaction</DialogTitle></DialogHeader>
        {txn && (
          <div className="space-y-3">
            <div className="rounded border bg-muted/40 p-3 text-sm">
              <div><span className="text-muted-foreground">Date:</span> {txn.transaction_date}</div>
              <div><span className="text-muted-foreground">Amount:</span> {Number(txn.amount).toLocaleString()}</div>
              <div><span className="text-muted-foreground">Reference:</span> {txn.reference}</div>
            </div>
            <div>
              <Label>Payable type</Label>
              <Select value={type} onValueChange={(v: "interest" | "dividend") => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="interest">Debenture Interest</SelectItem>
                  <SelectItem value="dividend">Stock Dividend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {suggestion && (
              <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">
                <div className="mb-2 font-medium">Suggested match (amount equals)</div>
                <div className="flex items-center justify-between">
                  <div>Due {suggestion.due_date} · {Number(suggestion.net_payable).toLocaleString()}</div>
                  <Button size="sm" onClick={() => doMatch(suggestion.id)}>Match this</Button>
                </div>
              </div>
            )}
            <div className="max-h-72 overflow-auto rounded border">
              <Table>
                <TableHeader><TableRow><TableHead>Due</TableHead><TableHead>Net Payable</TableHead><TableHead></TableHead></TableRow></TableHeader>
                <TableBody>
                  {candidates.length === 0 && <TableRow><TableCell colSpan={3} className="py-6 text-center text-muted-foreground">No pending payables</TableCell></TableRow>}
                  {candidates.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>{c.due_date}</TableCell>
                      <TableCell>{Number(c.net_payable ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => doMatch(c.id)}>Match</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
