import { useMemo, useState } from "react";
import {
  useTolls,
  useTollLocations,
  useTrucks,
  useDrivers,
  usePayments,
  useActiveTrips,
  useSettings,
  uid,
  formatBRL,
  formatDateBR,
  toBrasiliaISO,
  toBrasiliaInput,
  type Toll,
  type ExpenseResponsibility,
  type Attachment,
} from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Calendar,
  Truck as TruckIcon,
  FileDown,
  X,
  Coins,
  User as UserIcon,
  Zap,
  Lock,
  Code as Code2,
  Link2,
  ChevronLeft,
  ListFilter as Filter,
  MapPin,
  Route,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentsField, AttachmentsList } from "@/components/Attachments";
import { Pagination, PAGE_SIZE } from "@/components/Pagination";
import { JsonEditorDialog } from "@/components/JsonEditorDialog";
import {
  buildPdfDoc,
  previewPdf,
  pdfKpiRow,
  pdfSectionTitle,
  pdfTableLayout,
  PDF_COLORS,
  th,
} from "@/lib/pdf-theme";
import { cn } from "@/lib/utils";

const RESP_LABEL: Record<ExpenseResponsibility, string> = {
  minha: "Minha despesa",
  desconto: "Frigorífico desconta",
  ressarcir: "Frigorífico ressarce",
};

const RESP_TONE: Record<ExpenseResponsibility, { bg: string; text: string }> = {
  minha: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400" },
  desconto: { bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  ressarcir: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  });
}

/** Builds a static OpenStreetMap mini-map URL for a lat/lng. */
function miniMapUrl(lat: number, lng: number, size = 240): string {
  const delta = 0.01;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=13&size=${size}x${size}&bbox=${bbox}&marker=${lat},${lng}`;
}

type TollView = "all" | "unlinked" | string;

export function TollsSection() {
  const [tolls, setTolls] = useTolls();
  const [tollLocations] = useTollLocations();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const [payments] = usePayments();
  const [trips] = useActiveTrips();
  const lockedIds = useMemo(() => new Set(payments.flatMap((p) => p.tollIds)), [payments]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Toll | null>(null);
  const [settings] = useSettings();
  const [jsonEditItem, setJsonEditItem] = useState<Toll | null>(null);
  const [jsonEditOpen, setJsonEditOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [driverFilter, setDriverFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<"__all__" | "aberto" | "pago">("__all__");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<TollView>("all");
  const [linkDialogToll, setLinkDialogToll] = useState<Toll | null>(null);
  const [linkTripId, setLinkTripId] = useState("");

  const isTruckView = view !== "all" && view !== "unlinked";

  const locById = useMemo(
    () => new Map(tollLocations.map((l) => [l.id, l])),
    [tollLocations],
  );

  const filtered = useMemo(
    () =>
      tolls.filter((t) => {
        const d = t.dateTime.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        if (driverFilter === "__none__" && t.driverId) return false;
        if (driverFilter !== "__all__" && driverFilter !== "__none__" && t.driverId !== driverFilter)
          return false;
        if (statusFilter === "aberto" && lockedIds.has(t.id)) return false;
        if (statusFilter === "pago" && !lockedIds.has(t.id)) return false;
        if (view === "unlinked") {
          if (t.tripId) return false;
        } else if (isTruckView) {
          if (t.truckId !== view) return false;
        }
        return true;
      }),
    [tolls, dateFrom, dateTo, driverFilter, statusFilter, lockedIds, view, isTruckView],
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.dateTime.localeCompare(a.dateTime)),
    [filtered],
  );
  const totalValue = useMemo(() => sorted.reduce((s, t) => s + t.value, 0), [sorted]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );
  useMemo(() => {
    setPage(1);
  }, [dateFrom, dateTo, driverFilter, statusFilter, view]);

  const remove = (id: string) => {
    if (lockedIds.has(id)) {
      toast.error("Pedágio está em um recebimento. Exclua o recebimento antes.");
      return;
    }
    setTolls((prev) => prev.filter((t) => t.id !== id));
    toast.success("Pedágio removido");
  };

  const suggestTrip = (toll: Toll): { tripId: string; label: string } | null => {
    if (toll.tripId) return null;
    const tollTime = new Date(toll.dateTime).getTime();
    if (isNaN(tollTime)) return null;
    const candidates = trips
      .filter((t) => (!toll.truckId || t.truckId === toll.truckId) && t.departureTime)
      .filter((t) => {
        const dep = new Date(t.departureTime!).getTime();
        const arr = t.arrivalTime ? new Date(t.arrivalTime).getTime() : Date.now();
        return tollTime >= dep && tollTime <= arr;
      })
      .sort(
        (a, b) =>
          Math.abs(tollTime - new Date(a.departureTime!).getTime()) -
          Math.abs(tollTime - new Date(b.departureTime!).getTime()),
      );
    if (candidates.length === 0) return null;
    const best = candidates[0];
    return {
      tripId: best.id,
      label: `${formatDateBR(best.date)} • ${best.origin} → ${best.destination}`,
    };
  };

  const linkTrip = (toll: Toll, tripId: string) => {
    setTolls((prev) =>
      prev.map((t) => (t.id === toll.id ? { ...t, tripId: tripId || undefined } : t)),
    );
    toast.success(tripId ? "Pedágio vinculado à viagem" : "Vínculo removido");
  };

  const generatePDF = async () => {
    if (filtered.length === 0) {
      toast.error("Nenhum pedágio no período.");
      return;
    }
    try {
      const grouped = new Map<string, { semParar: Toll[]; normal: Toll[] }>();
      for (const t of filtered) {
        const key = t.truckId ?? "__sem__";
        const g = grouped.get(key) ?? { semParar: [], normal: [] };
        (t.semParar ? g.semParar : g.normal).push(t);
        grouped.set(key, g);
      }
      const periodo =
        dateFrom || dateTo
          ? `Período: ${dateFrom ? new Date(dateFrom + "T00:00").toLocaleDateString("pt-BR") : "início"} até ${dateTo ? new Date(dateTo + "T00:00").toLocaleDateString("pt-BR") : "hoje"}`
          : "Período: todos os pedágios";
      const grandTotal = filtered.reduce((s, t) => s + t.value, 0);
      const grandSemParar = filtered.filter((t) => t.semParar).reduce((s, t) => s + t.value, 0);
      const grandNormal = grandTotal - grandSemParar;
      const content: unknown[] = [
        pdfKpiRow([
          { label: "Registros", value: String(filtered.length) },
          { label: "Sem Parar", value: formatBRL(grandSemParar), color: PDF_COLORS.accent },
          { label: "Normal", value: formatBRL(grandNormal), color: PDF_COLORS.muted },
          { label: "Total", value: formatBRL(grandTotal), color: PDF_COLORS.primaryDark },
        ]),
        { text: periodo, style: "subtle", margin: [0, 0, 0, 8] },
      ];
      const truckOf = (t: Toll) => {
        const tr = trucks.find((x) => x.id === t.truckId);
        return tr ? `${tr.name} (${tr.plate})` : "-";
      };
      const locLabel = (t: Toll) => {
        const loc = locById.get(t.tollLocationId ?? "");
        if (loc) return `${loc.name} (${loc.highway} km ${loc.km})`;
        return t.tollName;
      };
      const buildTable = (list: Toll[]) => {
        const rows: unknown[][] = [
          [th("Data/Hora"), th("Pedágio"), th("Caminhão"), th("Valor")],
        ];
        for (const t of list) {
          rows.push([fmtDateTime(t.dateTime), locLabel(t), truckOf(t), formatBRL(t.value)]);
        }
        const subtotal = list.reduce((s, x) => s + x.value, 0);
        rows.push([
          { text: `Subtotal (${list.length})`, colSpan: 3, alignment: "right", bold: true, color: PDF_COLORS.primaryDark },
          {},
          {},
          { text: formatBRL(subtotal), bold: true, color: PDF_COLORS.primaryDark },
        ]);
        return { rows, subtotal };
      };
      const truckKeys = Array.from(grouped.keys());
      truckKeys.forEach((truckId, idx) => {
        const g = grouped.get(truckId)!;
        const truck = trucks.find((x) => x.id === truckId);
        const label =
          truckId === "__sem__"
            ? "Sem caminhão informado"
            : `${truck?.name ?? "Caminhão removido"} — ${truck?.plate ?? "—"}`;
        content.push({ ...pdfSectionTitle(label), ...(idx > 0 ? { pageBreak: "before" } : {}) });
        if (g.semParar.length > 0) {
          const { rows } = buildTable([...g.semParar].sort((a, b) => a.dateTime.localeCompare(b.dateTime)));
          content.push({ text: "Sem Parar", bold: true, fontSize: 10, color: PDF_COLORS.accent, margin: [0, 4, 0, 4] });
          content.push({ table: { headerRows: 1, widths: ["auto", "*", "*", "auto"], body: rows }, layout: pdfTableLayout, fontSize: 9 });
        }
        if (g.normal.length > 0) {
          const { rows } = buildTable([...g.normal].sort((a, b) => a.dateTime.localeCompare(b.dateTime)));
          content.push({ text: "Pagamento normal", bold: true, fontSize: 10, color: PDF_COLORS.muted, margin: [0, 6, 0, 4] });
          content.push({ table: { headerRows: 1, widths: ["auto", "*", "*", "auto"], body: rows }, layout: pdfTableLayout, fontSize: 9 });
        }
      });
      content.push({
        text: `Sem Parar: ${formatBRL(grandSemParar)}  •  Normal: ${formatBRL(grandNormal)}  •  Total geral: ${formatBRL(grandTotal)}`,
        style: "total",
        margin: [0, 16, 0, 0],
      });
      await previewPdf(
        buildPdfDoc({ title: "Relatório de Pedágios", subtitle: periodo, content }),
        `relatorio-pedagios-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    }
  };

  const navItems = useMemo(() => {
    const items: { key: TollView; label: string; icon: typeof Coins; desc: string; count: number }[] = [
      { key: "all", label: "Todos os pedágios", icon: Coins, desc: "Ver todos os registros", count: tolls.length },
    ];
    for (const tr of trucks) {
      items.push({ key: tr.id, label: tr.name, icon: TruckIcon, desc: tr.plate, count: tolls.filter((t) => t.truckId === tr.id).length });
    }
    items.push({ key: "unlinked", label: "Sem viagem", icon: Link2, desc: "Pedágios sem vínculo", count: tolls.filter((t) => !t.tripId).length });
    return items;
  }, [trucks, tolls]);

  const activeNav = navItems.find((n) => n.key === view) ?? navItems[0];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={generatePDF}>
          <FileDown className="mr-1.5 h-4 w-4" /> Gerar PDF
        </Button>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="mr-1.5 h-4 w-4" /> Novo pedágio
            </Button>
          </DialogTrigger>
          <TollDialog
            key={editing?.id ?? "new"}
            toll={editing}
            onSaved={() => {
              setOpen(false);
              setEditing(null);
            }}
          />
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="md:sticky md:top-6 md:self-start">
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
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

        <div className="min-w-0 space-y-4">
          <div className="mb-1 flex items-center gap-2 md:hidden">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">{activeNav.desc}</span>
          </div>

          {view === "unlinked" && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <Filter className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Pedágios sem viagem vinculada</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Estes pedágios não estão vinculados a nenhuma viagem. Com base nos registros de
                  saída e chegada, sugerimos a viagem mais provável.
                </p>
              </div>
            </div>
          )}

          <Card className="p-4 shadow-soft">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <Label className="text-xs">De</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">Até</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
              </div>
              <div>
                <Label className="text-xs">Motorista</Label>
                <Select value={driverFilter} onValueChange={setDriverFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="__none__">Sem motorista</SelectItem>
                    {drivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                        {!d.active ? " ⚰️" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="aberto">Em aberto</SelectItem>
                    <SelectItem value="pago">Recebidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(dateFrom || dateTo || driverFilter !== "__all__" || statusFilter !== "__all__") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setDriverFilter("__all__");
                    setStatusFilter("__all__");
                  }}
                >
                  <X className="mr-1 h-3 w-3" /> Limpar
                </Button>
              )}
              <div className="ml-auto text-right">
                <p className="text-xs text-muted-foreground">{sorted.length} registro(s)</p>
                <p className="text-lg font-bold text-primary">{formatBRL(totalValue)}</p>
              </div>
            </div>
          </Card>

          {sorted.length === 0 ? (
            <Card className="flex flex-col items-center justify-center gap-3 p-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Coins className="h-7 w-7 text-primary" />
              </div>
              <p className="text-lg font-semibold">Nenhum pedágio</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {view === "unlinked"
                  ? "Nenhum pedágio sem viagem vinculado no momento."
                  : "Registre um novo pedágio para começar."}
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {paged.map((t) => {
                const truck = trucks.find((x) => x.id === t.truckId);
                const driver = drivers.find((x) => x.id === t.driverId);
                const locked = lockedIds.has(t.id);
                const loc = locById.get(t.tollLocationId ?? "");
                const suggestion = view === "unlinked" ? suggestTrip(t) : null;
                const tone = RESP_TONE[t.responsibility];
                return (
                  <Card
                    key={t.id}
                    className="flex flex-col overflow-hidden border-l-4 shadow-soft transition-all hover:shadow-md"
                    style={{
                      borderLeftColor: t.semParar ? "rgb(245 158 11)" : "rgb(59 130 246)",
                    }}
                  >
                    {/* Map thumbnail */}
                    {loc?.latitude != null && loc?.longitude != null && (
                      <div className="relative h-32 w-full overflow-hidden bg-muted">
                        <img
                          src={miniMapUrl(loc.latitude, loc.longitude, 400)}
                          alt={`Mapa: ${loc.name}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                          }}
                        />
                        <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                          {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                        </div>
                      </div>
                    )}
                    <div className="flex flex-1 flex-col gap-3 p-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {t.semParar ? (
                            <Badge className="bg-amber-500 hover:bg-amber-500/90">
                              <Zap className="mr-1 h-3 w-3" /> Sem Parar
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Normal</Badge>
                          )}
                          <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", tone.bg, tone.text)}>
                            {RESP_LABEL[t.responsibility]}
                          </span>
                          {locked && (
                            <Badge variant="outline" className="border-amber-500 text-amber-600">
                              <Lock className="mr-1 h-3 w-3" /> Recebimento
                            </Badge>
                          )}
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-base font-semibold leading-tight">
                            <Coins className="h-4 w-4 shrink-0 text-accent" />
                            {t.tollName}
                          </p>
                          {loc && (
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {loc.highway && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <Route className="h-3 w-3" /> {loc.highway}
                                </span>
                              )}
                              {loc.km && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  KM {loc.km}
                                </span>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {loc.direction}
                              </Badge>
                              {loc.city && (
                                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" /> {loc.city}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {fmtDateTime(t.dateTime)}
                          </span>
                          {truck && (
                            <span className="flex items-center gap-1">
                              <TruckIcon className="h-3 w-3" />
                              {truck.name}
                            </span>
                          )}
                          {driver && (
                            <span className="flex items-center gap-1">
                              <UserIcon className="h-3 w-3" />
                              {driver.name}
                            </span>
                          )}
                        </div>
                        {t.notes && (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{t.notes}</p>
                        )}
                        {suggestion && (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                            <Link2 className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs text-muted-foreground">Sugerida:</span>
                            <span className="text-xs font-medium">{suggestion.label}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={() => linkTrip(t, suggestion.tripId)}
                            >
                              Vincular
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => {
                                setLinkDialogToll(t);
                                setLinkTripId("");
                              }}
                            >
                              Outra
                            </Button>
                          </div>
                        )}
                        <AttachmentsList items={t.attachments} />
                      </div>
                      <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor</p>
                          <p className="text-xl font-bold text-primary">{formatBRL(t.value)}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={locked}
                            onClick={() => {
                              setEditing(t);
                              setOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {settings.editorMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar JSON"
                              onClick={() => {
                                setJsonEditItem(t);
                                setJsonEditOpen(true);
                              }}
                            >
                              <Code2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={locked}
                            onClick={() => remove(t.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      </div>

      <Dialog open={!!linkDialogToll} onOpenChange={(o) => !o && setLinkDialogToll(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vincular à viagem</DialogTitle>
            <DialogDescription>Escolha uma viagem para vincular este pedágio.</DialogDescription>
          </DialogHeader>
          {linkDialogToll && (
            <div className="rounded-lg border border-border bg-secondary/30 p-3 text-sm">
              <p className="font-medium">{linkDialogToll.tollName}</p>
              <p className="text-muted-foreground">{fmtDateTime(linkDialogToll.dateTime)}</p>
            </div>
          )}
          <Select
            value={linkTripId || "__none__"}
            onValueChange={(v) => setLinkTripId(v === "__none__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="—" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não vincular —</SelectItem>
              {trips
                .filter((t) => !linkDialogToll?.truckId || t.truckId === linkDialogToll.truckId)
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {formatDateBR(t.date)} • {t.origin} → {t.destination}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLinkDialogToll(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (linkDialogToll) {
                  linkTrip(linkDialogToll, linkTripId);
                  setLinkDialogToll(null);
                }
              }}
            >
              <Link2 className="mr-1.5 h-4 w-4" /> Vincular
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JsonEditorDialog
        open={jsonEditOpen}
        onOpenChange={setJsonEditOpen}
        title={`Editar pedágio — ${jsonEditItem?.tollName ?? ""}`}
        data={jsonEditItem}
        onSave={(updated) => {
          if (jsonEditItem && updated && typeof updated === "object") {
            setTolls((prev) =>
              prev.map((t) => (t.id === jsonEditItem.id ? (updated as Toll) : t)),
            );
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toll form dialog
// ---------------------------------------------------------------------------

function TollDialog({ toll, onSaved }: { toll: Toll | null; onSaved: () => void }) {
  const [, setTolls] = useTolls();
  const [tollLocations] = useTollLocations();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const [trips] = useActiveTrips();

  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.active || d.id === toll?.driverId),
    [drivers, toll?.driverId],
  );

  const [dateTime, setDateTime] = useState(
    toll ? toBrasiliaInput(toll.dateTime) : toBrasiliaInput(new Date().toISOString()),
  );
  const [tollLocationId, setTollLocationId] = useState(toll?.tollLocationId ?? "");
  const [tollName, setTollName] = useState(toll?.tollName ?? "");
  const [truckId, setTruckId] = useState(toll?.truckId ?? "");
  const [driverId, setDriverId] = useState(toll?.driverId ?? "");
  const [tripId, setTripId] = useState(toll?.tripId ?? "");
  const [value, setValue] = useState(toll ? String(toll.value) : "");
  // Defaults: Sem Parar ON, Frigorífico ressarce
  const [semParar, setSemParar] = useState(toll?.semParar ?? true);
  const [responsibility, setResponsibility] = useState<ExpenseResponsibility>(
    toll?.responsibility ?? "ressarcir",
  );
  const [notes, setNotes] = useState(toll?.notes ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(toll?.attachments ?? []);

  const selectedLoc = tollLocations.find((l) => l.id === tollLocationId);

  const tripOptions = useMemo(
    () =>
      trips
        .filter((t) => (truckId ? t.truckId === truckId : true))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [trips, truckId],
  );

  const onLocChange = (id: string) => {
    const loc = tollLocations.find((l) => l.id === id);
    setTollLocationId(id);
    if (loc) setTollName(loc.name);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tollName.trim()) {
      toast.error("Selecione ou informe o pedágio.");
      return;
    }
    if (!dateTime) {
      toast.error("Informe a data e hora.");
      return;
    }
    const v = Number(value);
    if (!v || v <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    const next: Toll = {
      id: toll?.id ?? uid(),
      dateTime: toBrasiliaISO(dateTime),
      tollName: tollName.trim(),
      tollLocationId: tollLocationId || undefined,
      truckId: truckId || undefined,
      driverId: driverId || undefined,
      tripId: tripId || undefined,
      value: v,
      semParar,
      responsibility,
      notes: notes.trim() || undefined,
      attachments,
    };
    setTolls((prev) => (toll ? prev.map((p) => (p.id === toll.id ? next : p)) : [...prev, next]));
    toast.success(toll ? "Pedágio atualizado" : `Pedágio registrado — ${formatBRL(v)}`);
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{toll ? "Editar pedágio" : "Novo pedágio"}</DialogTitle>
        <DialogDescription>
          Registre uma passagem em pedágio, Sem Parar ou pagamento normal.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Data e hora</Label>
            <Input
              type="datetime-local"
              value={dateTime}
              onChange={(e) => setDateTime(e.target.value)}
            />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
        </div>

        {/* Toll location selector + map */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Pedágio cadastrado</Label>
            <Select value={tollLocationId || "__none__"} onValueChange={(v) => onLocChange(v === "__none__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder={tollLocations.length ? "Selecione..." : "Nenhum cadastrado"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Informar manualmente —</SelectItem>
                {tollLocations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name} {l.highway && `· ${l.highway}`} {l.km && `km ${l.km}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={tollName}
              onChange={(e) => setTollName(e.target.value)}
              placeholder="Nome do pedágio"
            />
            {selectedLoc && (
              <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                {selectedLoc.highway && (
                  <span className="inline-flex items-center gap-1">
                    <Route className="h-3 w-3" /> {selectedLoc.highway}
                  </span>
                )}
                {selectedLoc.km && <span>KM {selectedLoc.km}</span>}
                {selectedLoc.city && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> {selectedLoc.city}
                  </span>
                )}
                <Badge variant="outline" className="text-xs">
                  {selectedLoc.direction}
                </Badge>
              </div>
            )}
          </div>
          {/* Mini map */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Localização</Label>
            {selectedLoc?.latitude != null && selectedLoc?.longitude != null ? (
              <div className="relative h-36 overflow-hidden rounded-lg border border-border bg-muted">
                <img
                  src={miniMapUrl(selectedLoc.latitude, selectedLoc.longitude, 300)}
                  alt={`Mapa: ${selectedLoc.name}`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget.parentElement as HTMLElement).innerHTML =
                      '<div class="flex h-full items-center justify-center text-xs text-muted-foreground">Mapa indisponível</div>';
                  }}
                />
                <div className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  {selectedLoc.latitude.toFixed(4)}, {selectedLoc.longitude.toFixed(4)}
                </div>
              </div>
            ) : (
              <div className="flex h-36 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                Selecione um pedágio com coordenadas
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Caminhão (opcional)</Label>
            <Select
              value={truckId || "__none__"}
              onValueChange={(v) => {
                const next = v === "__none__" ? "" : v;
                setTruckId(next);
                if (tripId) {
                  const tr = trips.find((t) => t.id === tripId);
                  if (!tr || (next && tr.truckId !== next)) setTripId("");
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum —</SelectItem>
                {trucks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.plate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motorista (opcional)</Label>
            <Select
              value={driverId || "__none__"}
              onValueChange={(v) => setDriverId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhum —</SelectItem>
                {availableDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {!d.active ? " (inativo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Viagem vinculada (opcional)</Label>
          <Select
            value={tripId || "__none__"}
            onValueChange={(v) => setTripId(v === "__none__" ? "" : v)}
          >
            <SelectTrigger>
              <SelectValue placeholder={tripOptions.length ? "—" : "Nenhuma viagem disponível"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Não vincular a viagens —</SelectItem>
              {tripOptions.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {formatDateBR(t.date)} • {t.origin} → {t.destination}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="flex items-center gap-2">
            <Switch id="semparar" checked={semParar} onCheckedChange={setSemParar} />
            <Label htmlFor="semparar" className="cursor-pointer">
              Sem Parar
            </Label>
          </div>
          <RadioGroup
            value={responsibility}
            onValueChange={(v) => setResponsibility(v as ExpenseResponsibility)}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="tr-minha" value="minha" />
              <Label htmlFor="tr-minha" className="cursor-pointer font-normal">
                Minha despesa
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="tr-desc" value="desconto" />
              <Label htmlFor="tr-desc" className="cursor-pointer font-normal">
                Frigorífico desconta
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="tr-ress" value="ressarcir" />
              <Label htmlFor="tr-ress" className="cursor-pointer font-normal">
                Frigorífico ressarce
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div>
          <Label>Observações (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Detalhes adicionais..."
          />
        </div>

        <div>
          <AttachmentsField
            value={attachments}
            onChange={setAttachments}
            label="Anexos (comprovante, foto...)"
          />
        </div>

        <DialogFooter>
          <Button type="submit" size="lg">
            {toll ? "Salvar alterações" : "Salvar pedágio"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
