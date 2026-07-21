import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import {
  Wallet,
  LineChart,
  Building2,
  Users,
  ArrowLeftRight,
  ClipboardCheck,
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function fmt(n: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);
}

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async () => {
      const [companies, clients, interest, dividend, bank, approvals] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("interest_payables").select("net_payable, payment_status"),
        supabase.from("dividend_payables").select("net_payable, payment_status"),
        supabase.from("bank_transactions").select("id, is_reconciled"),
        supabase.from("pending_approvals").select("id", { count: "exact", head: true }).eq("status", "Pending"),
      ]);
      const sum = (rows: { net_payable: number | null }[] | null, status?: string) =>
        (rows ?? [])
          .filter((r: { payment_status?: string }) => !status || r.payment_status === status)
          .reduce((a, r) => a + Number(r.net_payable ?? 0), 0);
      return {
        companies: companies.count ?? 0,
        clients: clients.count ?? 0,
        interestPending: sum(interest.data as { net_payable: number | null; payment_status?: string }[], "Pending"),
        interestPaid: sum(interest.data as { net_payable: number | null; payment_status?: string }[], "Paid"),
        dividendPending: sum(dividend.data as { net_payable: number | null; payment_status?: string }[], "Pending"),
        dividendPaid: sum(dividend.data as { net_payable: number | null; payment_status?: string }[], "Paid"),
        bankTotal: bank.data?.length ?? 0,
        bankReconciled: (bank.data ?? []).filter((b: { is_reconciled: boolean }) => b.is_reconciled).length,
        approvals: approvals.count ?? 0,
      };
    },
  });

  const kpis = [
    { title: "Companies", value: data?.companies ?? 0, icon: Building2 },
    { title: "Clients", value: data?.clients ?? 0, icon: Users },
    { title: "Interest Pending", value: fmt(data?.interestPending ?? 0), icon: Wallet, prefix: "₨ " },
    { title: "Dividend Pending", value: fmt(data?.dividendPending ?? 0), icon: LineChart, prefix: "₨ " },
    { title: "Bank Txns", value: `${data?.bankReconciled ?? 0}/${data?.bankTotal ?? 0}`, icon: ArrowLeftRight },
    { title: "Pending Approvals", value: data?.approvals ?? 0, icon: ClipboardCheck },
  ];

  const chart = [
    { name: "Interest", Paid: data?.interestPaid ?? 0, Pending: data?.interestPending ?? 0 },
    { name: "Dividend", Paid: data?.dividendPaid ?? 0, Pending: data?.dividendPending ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live view of payables, reconciliation, and approvals across the platform."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <Card key={k.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{k.title}</CardTitle>
              <k.icon className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">
                {k.prefix}
                {isLoading ? "—" : k.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Payables — Paid vs Pending</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="Paid" fill="var(--color-chart-2)" radius={4} />
              <Bar dataKey="Pending" fill="var(--color-chart-3)" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
