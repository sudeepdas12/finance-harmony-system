import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Search, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeToggle } from "@/components/theme-toggle";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { open, setOpen } = useCommandPalette();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <Breadcrumbs />
            <div className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(true)}
              className="hidden gap-2 text-muted-foreground sm:inline-flex"
              aria-label="Open command palette"
            >
              <Search className="h-4 w-4" />
              <span>Search…</span>
              <kbd className="ml-2 hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground lg:inline-block">
                {isMac ? "⌘" : "Ctrl"} K
              </kbd>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              className="sm:hidden"
              aria-label="Open search"
            >
              <Search className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <div className="hidden items-center gap-1 md:flex">
              {roles.map((r) => (
                <Badge key={r} variant="secondary" className="capitalize">
                  {r.replace("_", " ")}
                </Badge>
              ))}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden max-w-[160px] truncate sm:inline">{user?.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </SidebarProvider>
  );
}
