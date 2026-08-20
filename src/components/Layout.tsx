import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Truck, Route as RouteIcon, Settings, LayoutDashboard, Users, Wallet, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/lib/theme";
import { PdfPreviewHost } from "@/components/PdfPreviewDialog";

const nav = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/viagens", label: "Viagens", icon: RouteIcon },
  { to: "/despesas", label: "Despesas", icon: Wallet },
  { to: "/recebimentos", label: "Recebimentos", icon: Banknote },
  { to: "/cadastros", label: "Cadastros", icon: Users },
  { to: "/configuracoes", label: "Config", icon: Settings },
] as const;

export function Layout() {
  const { location } = useRouterState();
  useTheme(); // aplica o tema salvo (padrão / liquid glass) no <html>
  return (
    <div className="min-h-screen bg-gradient-warm">
      <header className="border-b border-border/60 bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-hero shadow-soft">
              <Truck className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none text-foreground">Boiada</h1>
              <p className="text-xs text-muted-foreground">Controle de viagens</p>
            </div>
          </Link>
          <nav className="hidden gap-1 md:flex">
            {nav.map((item) => {
              const active =
                item.to === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.to);
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-soft"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-border/60 px-4 py-2 md:hidden">
          {nav.map((item) => {
            const active =
              item.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
      <Toaster richColors position="top-right" />
      <PdfPreviewHost />
    </div>
  );
}