import { useMemo, useState } from "react";
import {
  useActiveTrips,
  useTrucks,
  useDrivers,
  formatBRL,
  formatDateBR,
  toBrasiliaISO,
  toBrasiliaInput,
  DESTINATION_LABELS,
  type Trip,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Truck as TruckIcon,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  CircleCheck as CheckCircle2,
  LogIn,
  LogOut,
  LogOut as SectionIcon,
  EyeOff,
  Eraser,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatTime(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

export function DepartureArrivalSection() {
  const [trips, setTrips] = useActiveTrips();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const [truckFilter, setTruckFilter] = useState<string>("__all__");
  const [dialogTrip, setDialogTrip] = useState<Trip | null>(null);
  const [dialogMode, setDialogMode] = useState<"departure" | "arrival">("departure");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [timeInput, setTimeInput] = useState("");

  const pendingTrips = useMemo(() => {
    return trips
      .filter((t) => !t.skipTracking)
      .filter((t) => !t.departureTime || !t.arrivalTime)
      .filter((t) => truckFilter === "__all__" || t.truckId === truckFilter)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [trips, truckFilter]);

  const openDialog = (trip: Trip, mode: "departure" | "arrival") => {
    setDialogTrip(trip);
    setDialogMode(mode);
    setTimeInput(toBrasiliaInput(mode === "departure" ? trip.departureTime : trip.arrivalTime));
    setDialogOpen(true);
  };

  const confirmTime = () => {
    if (!dialogTrip || !timeInput) {
      toast.error("Informe a data e hora.");
      return;
    }
    const iso = toBrasiliaISO(timeInput);
    setTrips((prev) =>
      prev.map((t) =>
        t.id === dialogTrip.id
          ? {
              ...t,
              departureTime: dialogMode === "departure" ? iso : t.departureTime,
              arrivalTime: dialogMode === "arrival" ? iso : t.arrivalTime,
            }
          : t,
      ),
    );
    toast.success(dialogMode === "departure" ? "Saída registrada" : "Chegada registrada");
    setDialogOpen(false);
    setDialogTrip(null);
  };

  const skipTracking = (trip: Trip) => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === trip.id
          ? { ...t, skipTracking: true, departureTime: undefined, arrivalTime: undefined }
          : t,
      ),
    );
    toast.success("Viagem removida do controle de saída/chegada");
  };

  const clearTime = (trip: Trip, mode: "departure" | "arrival") => {
    setTrips((prev) =>
      prev.map((t) =>
        t.id === trip.id
          ? {
              ...t,
              departureTime: mode === "departure" ? undefined : t.departureTime,
              arrivalTime: mode === "arrival" ? undefined : t.arrivalTime,
            }
          : t,
      ),
    );
    toast.success(mode === "departure" ? "Saída desfeita" : "Chegada desfeita");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <SectionIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Saída &amp; Chegada</h2>
          <p className="text-sm text-muted-foreground">
            Registro de horários de saída e chegada.
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
          {pendingTrips.length} pendente(s)
        </Badge>
      </div>

      {pendingTrips.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-semibold">Tudo em dia</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Nenhuma viagem pendente de registro de saída ou chegada.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingTrips.map((t) => {
            const truck = trucks.find((x) => x.id === t.truckId);
            const driver = drivers.find((x) => x.id === t.driverId);
            const hasDeparture = !!t.departureTime;
            const hasArrival = !!t.arrivalTime;
            return (
              <div
                key={t.id}
                className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 p-5">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        {formatDateBR(t.date)}
                      </span>
                      {truck && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <TruckIcon className="h-3 w-3" />
                          {truck.name} ({truck.plate})
                        </span>
                      )}
                      {driver && (
                        <span className="text-xs text-muted-foreground">{driver.name}</span>
                      )}
                    </div>
                    <p className="flex items-center gap-2 text-base font-semibold">
                      <MapPin className="h-4 w-4 text-accent" />
                      {t.origin} <ArrowRight className="h-4 w-4 text-muted-foreground" />{" "}
                      {t.destination ? DESTINATION_LABELS[t.destination] : "—"}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full",
                            hasDeparture
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <LogOut className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Saída</p>
                          <p className={hasDeparture ? "font-medium" : "text-muted-foreground"}>
                            {hasDeparture ? formatTime(t.departureTime) : "Pendente"}
                          </p>
                        </div>
                        {hasDeparture && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Desfazer saída"
                            onClick={() => clearTime(t, "departure")}
                          >
                            <Eraser className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-full",
                            hasArrival
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          <LogIn className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Chegada</p>
                          <p className={hasArrival ? "font-medium" : "text-muted-foreground"}>
                            {hasArrival ? formatTime(t.arrivalTime) : "Pendente"}
                          </p>
                        </div>
                        {hasArrival && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Desfazer chegada"
                            onClick={() => clearTime(t, "arrival")}
                          >
                            <Eraser className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {!hasDeparture && (
                      <Button size="sm" onClick={() => openDialog(t, "departure")}>
                        <LogOut className="mr-1.5 h-4 w-4" /> Registrar saída
                      </Button>
                    )}
                    {!hasArrival && hasDeparture && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openDialog(t, "arrival")}
                      >
                        <LogIn className="mr-1.5 h-4 w-4" /> Registrar chegada
                      </Button>
                    )}
                    {!hasArrival && !hasDeparture && (
                      <p className="text-xs text-muted-foreground text-right max-w-[180px]">
                        Registre a saída antes da chegada
                      </p>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground"
                      title="Ignorar esta viagem no controle de saída/chegada e histórico"
                      onClick={() => skipTracking(t)}
                    >
                      <EyeOff className="mr-1 h-3.5 w-3.5" /> Ignorar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "departure" ? "Registrar saída" : "Registrar chegada"}
            </DialogTitle>
            <DialogDescription>
              {dialogMode === "departure"
                ? "Horário em que o motorista saiu para a viagem."
                : "Horário em que o motorista chegou no frigorífico."}
            </DialogDescription>
          </DialogHeader>
          {dialogTrip && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <p className="font-medium">
                {dialogTrip.origin} →{" "}
                {dialogTrip.destination ? DESTINATION_LABELS[dialogTrip.destination] : "—"}
              </p>
              <p className="text-muted-foreground">{formatDateBR(dialogTrip.date)}</p>
            </div>
          )}
          <div>
            <Label className="mb-1.5">Data e hora</Label>
            <Input
              type="datetime-local"
              value={timeInput}
              onChange={(e) => setTimeInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmTime}>
              <Clock className="mr-1.5 h-4 w-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
