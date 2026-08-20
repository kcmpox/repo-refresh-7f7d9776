import { useMemo, useState } from "react";
import {
  useActiveTrips,
  useTrucks,
  useTolls,
  useFuelings,
  useExpenses,
  formatBRL,
  formatDateBR,
  DESTINATION_LABELS,
} from "@/lib/storage";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Truck as TruckIcon,
  MapPin,
  ArrowRight,
  LogOut,
  LogIn,
  Coins,
  Fuel,
  Wrench,
  Calendar,
  History as HistoryIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type HistoryEntry = {
  id: string;
  timestamp: string;
  type: "departure" | "arrival" | "toll" | "fueling" | "expense" | "trip_created";
  truckId?: string;
  truckName: string;
  description: string;
  detail?: string;
  value?: number;
};

export function HistorySection() {
  const [trips] = useActiveTrips();
  const [trucks] = useTrucks();
  const [tolls] = useTolls();
  const [fuelings] = useFuelings();
  const [expenses] = useExpenses();
  const [truckFilter, setTruckFilter] = useState<string>("__all__");

  const entries = useMemo<HistoryEntry[]>(() => {
    const truckName = (id?: string) => {
      const t = trucks.find((x) => x.id === id);
      return t ? `${t.name} (${t.plate})` : "Caminhão removido";
    };

    const list: HistoryEntry[] = [];

    for (const t of trips) {
      if (t.skipTracking) continue;
      if (t.departureTime) {
        list.push({
          id: `dep-${t.id}`,
          timestamp: t.departureTime,
          type: "departure",
          truckId: t.truckId,
          truckName: truckName(t.truckId),
          description: `Saiu para viagem: ${t.origin} → ${t.destination ? DESTINATION_LABELS[t.destination] : "—"}`,
          detail: formatDateBR(t.date),
        });
      }
      if (t.arrivalTime) {
        list.push({
          id: `arr-${t.id}`,
          timestamp: t.arrivalTime,
          type: "arrival",
          truckId: t.truckId,
          truckName: truckName(t.truckId),
          description: `Chegou no frigorífico: ${t.origin} → ${t.destination ? DESTINATION_LABELS[t.destination] : "—"}`,
          detail: formatDateBR(t.date),
        });
      }
    }

    for (const tl of tolls) {
      list.push({
        id: `toll-${tl.id}`,
        timestamp: tl.dateTime,
        type: "toll",
        truckId: tl.truckId,
        truckName: truckName(tl.truckId),
        description: `Pedágio: ${tl.tollName}`,
        detail: tl.semParar ? "Sem Parar" : "Pagamento normal",
        value: tl.value,
      });
    }

    for (const f of fuelings) {
      const total = f.items.reduce(
        (s, i) => s + i.quantity * i.unitPrice - (i.discount || 0),
        0,
      );
      list.push({
        id: `fuel-${f.id}`,
        timestamp: f.date,
        type: "fueling",
        truckId: f.truckId,
        truckName: truckName(f.truckId),
        description: "Abastecimento",
        detail: `Hod. ${f.odometer}`,
        value: total,
      });
    }

    for (const e of expenses) {
      list.push({
        id: `exp-${e.id}`,
        timestamp: e.date,
        type: "expense",
        truckId: e.truckId,
        truckName: truckName(e.truckId),
        description: `Manutenção: ${e.category}`,
        detail: e.description,
        value: e.value,
      });
    }

    return list
      .filter((e) => truckFilter === "__all__" || e.truckId === truckFilter)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [trips, trucks, tolls, fuelings, expenses, truckFilter]);

  const typeIcon = (type: HistoryEntry["type"]) => {
    switch (type) {
      case "departure":
        return <LogOut className="h-4 w-4 text-orange-500" />;
      case "arrival":
        return <LogIn className="h-4 w-4 text-emerald-600" />;
      case "toll":
        return <Coins className="h-4 w-4 text-amber-500" />;
      case "fueling":
        return <Fuel className="h-4 w-4 text-blue-500" />;
      case "expense":
        return <Wrench className="h-4 w-4 text-purple-500" />;
      default:
        return <MapPin className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const typeLabel = (type: HistoryEntry["type"]) => {
    switch (type) {
      case "departure":
        return "Saída";
      case "arrival":
        return "Chegada";
      case "toll":
        return "Pedágio";
      case "fueling":
        return "Combustível";
      case "expense":
        return "Manutenção";
      default:
        return "Viagem";
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HistoryIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Histórico</h2>
          <p className="text-sm text-muted-foreground">
            Linha do tempo de eventos.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted-foreground">Filtrar por caminhão:</span>
        <Select value={truckFilter} onValueChange={setTruckFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos</SelectItem>
            {trucks.map((tr) => (
              <SelectItem key={tr.id} value={tr.id}>
                {tr.name} ({tr.plate})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="ml-auto">
          {entries.length} evento(s)
        </Badge>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Calendar className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold">Sem histórico</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Eventos de saída, chegada, pedágios, combustíveis e manutenção aparecerão aqui em
            ordem cronológica.
          </p>
        </div>
      ) : (
        <div className="relative space-y-3">
          {entries.map((entry, idx) => (
            <div key={entry.id} className="flex gap-4">
              {/* Timeline dot and line */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-border bg-card",
                  )}
                >
                  {typeIcon(entry.type)}
                </div>
                {idx < entries.length - 1 && (
                  <div className="w-px flex-1 bg-border" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pb-4">
                <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {typeLabel(entry.type)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "short",
                            timeZone: "America/Sao_Paulo",
                          })}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TruckIcon className="h-3 w-3" />
                          {entry.truckName}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{entry.description}</p>
                      {entry.detail && (
                        <p className="text-xs text-muted-foreground">{entry.detail}</p>
                      )}
                    </div>
                    {entry.value !== undefined && (
                      <p className="text-sm font-bold text-primary">
                        {formatBRL(entry.value)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
