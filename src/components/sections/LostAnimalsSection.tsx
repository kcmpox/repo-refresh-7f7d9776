import { useMemo, useState } from "react";
import {
  useActiveTrips,
  useTrucks,
  useDrivers,
  formatBRL,
  formatDateBR,
  DESTINATION_LABELS,
  type Trip,
} from "@/lib/storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Truck as TruckIcon, MapPin, Calendar, ArrowRight, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, PawPrint } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function LostAnimalsSection() {
  const [trips, setTrips] = useActiveTrips();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const [dialogTrip, setDialogTrip] = useState<Trip | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lostCount, setLostCount] = useState("0");
  const [animalValue, setAnimalValue] = useState("0");

  const arrivedTrips = useMemo(() => {
    return trips
      .filter((t) => t.arrivalTime && !t.lostAnimalsConfirmed)
      .sort((a, b) => (b.arrivalTime ?? "").localeCompare(a.arrivalTime ?? ""));
  }, [trips]);

  const openDialog = (trip: Trip) => {
    setDialogTrip(trip);
    setLostCount(String(trip.lostAnimals));
    setAnimalValue(String(trip.lostAnimalValue));
    setDialogOpen(true);
  };

  const confirm = () => {
    if (!dialogTrip) return;
    const count = Number(lostCount);
    const value = Number(animalValue);
    if (isNaN(count) || count < 0) {
      toast.error("Quantidade inválida.");
      return;
    }
    const lossTotal = count * value;
    const finalValue = Math.max(0, dialogTrip.tableValue - lossTotal);
    setTrips((prev) =>
      prev.map((t) =>
        t.id === dialogTrip.id
          ? {
              ...t,
              lostAnimals: count,
              lostAnimalValue: value,
              finalValue,
              lostAnimalsConfirmed: true,
            }
          : t,
      ),
    );
    toast.success(
      count > 0
        ? `${count} animal(is) perdido(s) registrado(s) — ${formatBRL(lossTotal)} de desconto`
        : "Nenhuma perda registrada",
    );
    setDialogOpen(false);
    setDialogTrip(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <PawPrint className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h2 className="text-xl font-bold tracking-tight">Animais Perdidos</h2>
          <p className="text-sm text-muted-foreground">
            Registrar perdas após a chegada.
          </p>
        </div>
        <Badge variant="secondary">{arrivedTrips.length} pendente(s)</Badge>
      </div>

      {arrivedTrips.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card p-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <PawPrint className="h-7 w-7 text-primary" />
          </div>
          <p className="text-lg font-semibold">Nenhuma viagem aguardando registro</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Viagens que chegaram ao frigorífico aparecerão aqui para registro de animais perdidos.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {arrivedTrips.map((t) => {
            const truck = trucks.find((x) => x.id === t.truckId);
            const driver = drivers.find((x) => x.id === t.driverId);
            const hasLoss = t.lostAnimals > 0;
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
                      {t.origin}{" "}
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />{" "}
                      {t.destination ? DESTINATION_LABELS[t.destination] : "—"}
                    </p>
                    {hasLoss && (
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium",
                          "bg-destructive/10 text-destructive",
                        )}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {t.lostAnimals} perdido(s) × {formatBRL(t.lostAnimalValue)} ={" "}
                        {formatBRL(t.lostAnimals * t.lostAnimalValue)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Valor da viagem</p>
                      <p className="text-xl font-bold text-primary">{formatBRL(t.finalValue)}</p>
                    </div>
                    <Button size="sm" onClick={() => openDialog(t)}>
                      {hasLoss ? (
                        <>
                          <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmar perda
                        </>
                      ) : (
                        <>
                          <PawPrint className="mr-1.5 h-4 w-4" /> Registrar perda
                        </>
                      )}
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
            <DialogTitle>Animais perdidos</DialogTitle>
            <DialogDescription>
              Informe quantos animais se perderam e o valor unitário para desconto.
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5">Animais perdidos</Label>
              <Input
                type="number"
                min="0"
                value={lostCount}
                onChange={(e) => setLostCount(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1.5">Valor por animal (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={animalValue}
                onChange={(e) => setAnimalValue(e.target.value)}
              />
            </div>
          </div>
          {Number(lostCount) > 0 && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <p className="text-muted-foreground">Desconto total</p>
              <p className="text-lg font-bold text-destructive">
                {formatBRL(Number(lostCount) * Number(animalValue))}
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={confirm}>
              <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
