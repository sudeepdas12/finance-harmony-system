import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Building2,
  Users,
  Wallet,
  LineChart,
  ArrowLeftRight,
  Coins,
  FileText,
  Upload,
  Calendar,
  ClipboardCheck,
  History,
  UserCog,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const sections = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Master Data",
    items: [
      { title: "Companies", url: "/companies", icon: Building2 },
      { title: "Clients", url: "/clients", icon: Users },
    ],
  },
  {
    label: "Payables",
    items: [
      { title: "Debenture Interest", url: "/interest", icon: Wallet },
      { title: "Stock Dividend", url: "/dividend", icon: LineChart },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Bank Reconciliation", url: "/reconciliation", icon: ArrowLeftRight },
      { title: "IAF Allocations", url: "/allocations", icon: Coins },
      { title: "Pending Approvals", url: "/approvals", icon: ClipboardCheck },
      { title: "Uploads", url: "/uploads", icon: Upload },
    ],
  },
  {
    label: "Insights",
    items: [
      { title: "Reports", url: "/reports", icon: FileText },
      { title: "Audit Log", url: "/audit", icon: History },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Users & Roles", url: "/users", icon: UserCog },
      { title: "Fiscal Years", url: "/settings/fiscal-years", icon: Calendar },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) => pathname === url || pathname.startsWith(url + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            R
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">RTA / RTS</span>
            <span className="text-[11px] text-sidebar-foreground/60">Registrar Console</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((s) => (
          <SidebarGroup key={s.label}>
            <SidebarGroupLabel>{s.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {s.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-1.5 text-[11px] text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden">
          v1.0 • Lovable Cloud
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
