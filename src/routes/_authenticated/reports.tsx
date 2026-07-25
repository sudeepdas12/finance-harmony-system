import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, FileText } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { exportToExcel } from "@/lib/xlsx-utils";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
});

type PayableRow = {
  id: string;
  net_payable: number | null;
  gross_interest?: number | null;
  gross_dividend?: number | null;
  tax_amount: number | null;
  payment_status: string;
  payment_date: string | null;
  due_date?: string | null;
  fiscal_year: string | null;
  company_id: string;
  client_id: string;
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function ReportsPage() {
  const [reportType, setReportType] = useState<"interest" | "dividend">("interest");
  const [fyFilter, setFyFilter] = useState<string>("all");

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, company_name, company_code");
      return data ?? [];
    },
  });

  const { data: fiscalYears = [] } = useQuery({
    queryKey: ["fiscal-years-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("fiscal_years").select("fiscal_year").order("fiscal_year", { ascending: false });
      return data ?? [];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["reports-payables", reportType],
    queryFn: async () => {
      const q = reportType === "interest"
        ? supabase.from("interest_payables").select("*")
        : supabase.from("dividend_payables").select("*");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PayableRow[];
    },
  });

  const filtered = useMemo(
    () => (fyFilter === "all" ? rows : rows.filter((r) => r.fiscal_year === fyFilter)),
    [rows, fyFilter],
  );

  const totals = useMemo(() => {
    const paid = filtered.filter((r) => r.payment_status === "Paid");
    const pending = filtered.filter((r) => r.payment_status === "Pending");
    const gross = (r: PayableRow) => Number(r.gross_interest ?? r.gross_dividend ?? 0);
    return {
      count: filtered.length,
      grossTotal: filtered.reduce((s, r) => s + gross(r), 0),
      taxTotal: filtered.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0),
      netTotal: filtered.reduce((s, r) => s + Number(r.net_payable ?? 0), 0),
      paidCount: paid.length,
      paidAmt: paid.reduce((s, r) => s + Number(r.net_payable ?? 0), 0),
      pendingCount: pending.length,
      pendingAmt: pending.reduce((s, r) => s + Number(r.net_payable ?? 0), 0),
    };
  }, [filtered]);

  const byCompany = useMemo(() => {
    const map = new Map<string, { name: string; Paid: number; Pending: number }>();
    for (const r of filtered) {
      const c = companies.find((x) => x.id === r.company_id);
      const name = c?.company_code ?? "Unknown";
      const cur = map.get(name) ?? { name, Paid: 0, Pending: 0 };
      const amt = Number(r.net_payable ?? 0);
      if (r.payment_status === "Paid") cur.Paid += amt;
      else cur.Pending += amt;
      map.set(name, cur);
    }
    return Array.from(map.values()).slice(0, 10);
  }, [filtered, companies]);

  const statusPie = [
    { name: "Paid", value: totals.paidAmt },
    { name: "Pending", value: totals.pendingAmt },
  ];

  const aging = useMemo(() => {
    if (reportType !== "interest") return [];
    const buckets = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    const now = Date.now();
    for (const r of filtered) {
      if (r.payment_status === "Paid" || !r.due_date) continue;
      const days = Math.floor((now - new Date(r.due_date).getTime()) / 86400000);
      const amt = Number(r.net_payable ?? 0);
      if (days <= 30) buckets["0-30"] += amt;
      else if (days <= 60) buckets["31-60"] += amt;
      else if (days <= 90) buckets["61-90"] += amt;
      else buckets["90+"] += amt;
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [filtered, reportType]);

  const onExport = () => {
    exportToExcel(
      filtered.map((r) => {
        const c = companies.find((x) => x.id === r.company_id);
        return {
          company: c?.company_name ?? "",
          company_code: c?.company_code ?? "",
          fiscal_year: r.fiscal_year,
          gross: Number(r.gross_interest ?? r.gross_dividend ?? 0),
          tax: Number(r.tax_amount ?? 0),
          net: Number(r.net_payable ?? 0),
          status: r.payment_status,
          due_date: r.due_date ?? "",
          payment_date: r.payment_date ?? "",
        };
      }),
      `${reportType}_report_${fyFilter}`,
    );
  };

  const onPrintPdf = () => window.print();

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Analytics, aging, and exports across payables."
        actions={
          <>
            <Button variant="outline" onClick={onPrintPdf}><FileText className="mr-2 h-4 w-4" />Print / PDF</Button>
            <Button onClick={onExport}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Select value={reportType} onValueChange={(v: "interest" | "dividend") => setReportType(v)}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="interest">Debenture Interest</SelectItem>
            <SelectItem value="dividend">Stock Dividend</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fyFilter} onValueChange={setFyFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="All fiscal years" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All fiscal years</SelectItem>
            {fiscalYears.map((f) => (
              <SelectItem key={f.fiscal_year} value={f.fiscal_year}>{f.fiscal_year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Records</div><div className="text-2xl font-semibold">{totals.count}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Gross</div><div className="text-2xl font-semibold">{fmt(totals.grossTotal)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tax</div><div className="text-2xl font-semibold">{fmt(totals.taxTotal)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Net Payable</div><div className="text-2xl font-semibold">{fmt(totals.netTotal)}</div></CardContent></Card>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Top Companies — Paid vs Pending</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCompany}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Paid" fill="hsl(var(--chart-2))" radius={4} />
                <Bar dataKey="Pending" fill="hsl(var(--chart-3))" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Payment Status</CardTitle></CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusPie} dataKey="value" nameKey="name" outerRadius={100} label>
                  {statusPie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {reportType === "interest" && (
        <Card className="mb-6">
          <CardHeader><CardTitle>Aging (Unpaid Interest)</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Bucket (days past due)</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {aging.map((a) => (
                  <TableRow key={a.name}>
                    <TableCell>{a.name}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(a.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Detail</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Company</TableHead>
              <TableHead>FY</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment Date</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">No records</TableCell></TableRow>}
              {filtered.slice(0, 200).map((r) => {
                const c = companies.find((x) => x.id === r.company_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{c?.company_name ?? "—"}</TableCell>
                    <TableCell>{r.fiscal_year}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.gross_interest ?? r.gross_dividend ?? 0))}</TableCell>
                    <TableCell className="text-right">{fmt(Number(r.tax_amount ?? 0))}</TableCell>
                    <TableCell className="text-right font-medium">{fmt(Number(r.net_payable ?? 0))}</TableCell>
                    <TableCell>{r.payment_status}</TableCell>
                    <TableCell>{r.payment_date ?? "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length > 200 && (
            <div className="p-3 text-center text-xs text-muted-foreground">Showing first 200 of {filtered.length}. Export Excel for full data.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
