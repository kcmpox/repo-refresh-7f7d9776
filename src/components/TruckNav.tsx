import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TruckNavItem {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  count: number;
}

/** Menu lateral de caminhões (mesmo padrão da subguia Pedágios). */
export function TruckNav({
  items,
  value,
  onChange,
}: {
  items: TruckNavItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <nav className="md:sticky md:top-6 md:self-start">
      <div className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = value === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                "group flex min-w-[130px] flex-1 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all md:min-w-0 md:flex-none",
                isActive
                  ? "border-primary/30 bg-primary/5 shadow-sm"
                  : "border-transparent hover:border-border hover:bg-muted/50",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground group-hover:bg-muted-foreground/15",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block truncate text-sm font-semibold",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
                <span className="hidden truncate text-xs text-muted-foreground md:block">
                  {item.desc}
                </span>
              </span>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {item.count}
              </Badge>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
