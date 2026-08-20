import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useTrips,
  useTrucks,
  useDrivers,
  usePriceTables,
  usePayments,
  useTolls,
  useSettings,
  calculateTripValue,
  formatBRL,
  formatDateBR,
  uid,
  DESTINATION_LABELS,
  type Trip,
  type CattleType,
  type Destination,
  type PriceTable,
} from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  MapPin,
  Calendar,
  Truck as TruckIcon,
  FileDown,
  X,
  User as UserIcon,
  Lock,
  Check,
  ChevronLeft,
  ChevronRight,
  Code as Code2,
  Route as RouteIcon,
  LogOut,
  LogIn,
  PawPrint,
  History as HistoryIcon,
  CircleDot,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentsField, AttachmentsList } from "@/components/Attachments";
import { JsonEditorDialog } from "@/components/JsonEditorDialog";
import type { Attachment } from "@/lib/storage";
import { Pagination, PAGE_SIZE } from "@/components/Pagination";
import { Checkbox } from "@/components/ui/checkbox";
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
import { DepartureArrivalSection } from "@/components/sections/DepartureArrivalSection";
import { LostAnimalsSection } from "@/components/sections/LostAnimalsSection";
import { HistorySection } from "@/components/sections/HistorySection";

// ---------------------------------------------------------------------------
// Sidebar navigation
// ---------------------------------------------------------------------------

type TripSectionKey = "viagens" | "saida" | "perdas" | "historico" | "arquivadas";

const TRIP_NAV_ITEMS: {
  key: TripSectionKey;
  label: string;
  icon: typeof RouteIcon;
  desc: string;
}[] = [
  {
    key: "viagens",
    label: "Viagens",
    icon: RouteIcon,
    desc: "Histórico completo de transportes",
  },
  {
    key: "saida",
    label: "Saída & Chegada",
    icon: LogOut,
    desc: "Registro de horários de saída e chegada",
  },
  {
    key: "perdas",
    label: "Animais Perdidos",
    icon: PawPrint,
    desc: "Registrar perdas após a chegada",
  },
  {
    key: "historico",
    label: "Histórico",
    icon: HistoryIcon,
    desc: "Linha do tempo de eventos",
  },
  {
    key: "arquivadas",
    label: "Arquivadas",
    icon: Archive,
    desc: "Viagens arquivadas — desarquive quando precisar",
  },
];

export const Route = createFileRoute("/viagens")({
  head: () => ({
    meta: [
      { title: "Viagens — Boiada" },
      {
        name: "description",
        content: "Registre e visualize todas as viagens de transporte de gado.",
      },
    ],
  }),
  component: TripsPage,
});

function getDistance(t: Trip) {
  if (t.kmStart > 0 || t.kmEnd > 0) return Math.max(0, t.kmEnd - t.kmStart);
  return t.manualDistance ?? 0;
}

function TripsPage() {
  const [section, setSection] = useState<TripSectionKey>("viagens");
  const active = TRIP_NAV_ITEMS.find((n) => n.key === section)!;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <RouteIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Viagens</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie viagens, saídas, chegadas e perdas de animais.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Sidebar nav */}
        <nav className="md:sticky md:top-6 md:self-start">
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            {TRIP_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = section === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setSection(item.key)}
                  className={cn(
                    "group flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all md:min-w-0 md:flex-none",
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
                  <span className="min-w-0">
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
                  {isActive && (
                    <CircleDot className="ml-auto hidden h-4 w-4 text-primary md:block" />
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-2 md:hidden">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">{active.desc}</span>
          </div>
          {section === "viagens" && <TripsListSection />}
          {section === "saida" && <DepartureArrivalSection />}
          {section === "perdas" && <LostAnimalsSection />}
          {section === "historico" && <HistorySection />}
          {section === "arquivadas" && <ArchivedTripsSection />}
        </div>
      </div>
    </div>
  );
}

function TripsListSection() {
  const [allTrips, setTrips] = useTrips();
  const trips = useMemo(() => allTrips.filter((t) => !t.archived), [allTrips]);
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const [tables] = usePriceTables();
  const [payments] = usePayments();
  const lockedTripIds = useMemo(() => new Set(payments.flatMap((p) => p.tripIds)), [payments]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [settings] = useSettings();
  const [jsonEditTrip, setJsonEditTrip] = useState<Trip | null>(null);
  const [jsonEditOpen, setJsonEditOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [driverFilter, setDriverFilter] = useState<string>("__all__");
  const [truckFilter, setTruckFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<"__all__" | "aberto" | "pago">("__all__");
  const [destFilter, setDestFilter] = useState<"__all__" | Destination>("__all__");
  const [page, setPage] = useState(1);

  const hasCurrentTable = tables.some((t) => t.name === "ATUAL");

  const filtered = useMemo(() => {
    return trips.filter((t) => {
      const d = t.date.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      if (driverFilter === "__none__" && t.driverId) return false;
      if (driverFilter !== "__all__" && driverFilter !== "__none__" && t.driverId !== driverFilter)
        return false;
      if (truckFilter !== "__all__" && t.truckId !== truckFilter) return false;
      if (destFilter !== "__all__" && t.destination !== destFilter) return false;
      if (statusFilter === "aberto" && lockedTripIds.has(t.id)) return false;
      if (statusFilter === "pago" && !lockedTripIds.has(t.id)) return false;
      return true;
    });
  }, [trips, dateFrom, dateTo, driverFilter, truckFilter, destFilter, statusFilter, lockedTripIds]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );
  const totalValue = useMemo(() => sorted.reduce((s, t) => s + t.finalValue, 0), [sorted]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );
  useMemo(() => {
    setPage(1);
  }, [dateFrom, dateTo, driverFilter, truckFilter, destFilter, statusFilter]);

  const remove = (id: string) => {
    if (lockedTripIds.has(id)) {
      toast.error("Viagem está em um recebimento. Exclua o recebimento antes.");
      return;
    }
    setTrips((prev) => prev.filter((t) => t.id !== id));
    toast.success("Viagem removida");
  };

  const archive = (id: string) => {
    if (lockedTripIds.has(id)) {
      toast.error("Viagem está em um recebimento. Exclua o recebimento antes de arquivar.");
      return;
    }
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, archived: true } : t)));
    toast.success("Viagem arquivada");
  };

  const generatePDF = async () => {
    if (filtered.length === 0) {
      toast.error("Nenhuma viagem no período selecionado.");
      return;
    }
    try {
      const grouped = new Map<string, Trip[]>();
      for (const t of filtered) {
        const arr = grouped.get(t.truckId) ?? [];
        arr.push(t);
        grouped.set(t.truckId, arr);
      }

      const periodo =
        dateFrom || dateTo
          ? `Período: ${dateFrom ? new Date(dateFrom + "T00:00").toLocaleDateString("pt-BR") : "início"} até ${dateTo ? new Date(dateTo + "T00:00").toLocaleDateString("pt-BR") : "hoje"}`
          : "Período: todas as viagens";

      const grandTotal = filtered.reduce((s, t) => s + t.finalValue, 0);
      const grandKm = filtered.reduce((s, t) => s + getDistance(t), 0);
      const grandLost = filtered.reduce((s, t) => s + t.lostAnimals * t.lostAnimalValue, 0);

      const content: unknown[] = [
        pdfKpiRow([
          { label: "Viagens", value: String(filtered.length) },
          {
            label: "Distância total",
            value: `${grandKm.toLocaleString("pt-BR")} km`,
            color: PDF_COLORS.accent,
          },
          { label: "Perdas", value: formatBRL(grandLost), color: PDF_COLORS.danger },
          { label: "Total", value: formatBRL(grandTotal), color: PDF_COLORS.primaryDark },
        ]),
        { text: periodo, style: "subtle", margin: [0, 0, 0, 8] },
      ];

      const truckIds = Array.from(grouped.keys());
      truckIds.forEach((truckId, idx) => {
        const list = grouped.get(truckId)!;
        const truck = trucks.find((x) => x.id === truckId);
        const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date));
        const subtotal = ordered.reduce((s, t) => s + t.finalValue, 0);
        const label = `${truck?.name ?? "Caminhão removido"} — ${truck?.plate ?? "—"}`;
        content.push({
          ...pdfSectionTitle(label),
          ...(idx > 0 ? { pageBreak: "before" } : {}),
        });
        content.push({
          table: {
            headerRows: 1,
            widths: ["auto", "*", "*", "*", "*", "auto", "auto", "auto"],
            body: [
              [
                th("Data"),
                th("Pecuarista"),
                th("Origem"),
                th("Destino"),
                th("Tabela"),
                th("Km"),
                th("Perdas"),
                th("Valor"),
              ],
              ...ordered.map((t) => [
                formatDateBR(t.date),
                t.pecuarista ?? "-",
                t.origin,
                t.destination ? DESTINATION_LABELS[t.destination] : "-",
                (() => {
                  const tbl = tables.find((x) => x.id === t.priceTableId);
                  return tbl?.name ?? t.priceTableName ?? "-";
                })(),
                String(getDistance(t)),
                t.lostAnimals > 0 ? formatBRL(t.lostAnimals * t.lostAnimalValue) : "-",
                formatBRL(t.finalValue),
              ]),
              [
                {
                  text: `Subtotal (${ordered.length})`,
                  colSpan: 7,
                  alignment: "right",
                  bold: true,
                  color: PDF_COLORS.primaryDark,
                },
                {},
                {},
                {},
                {},
                {},
                {},
                { text: formatBRL(subtotal), bold: true, color: PDF_COLORS.primaryDark },
              ],
            ],
          },
          layout: pdfTableLayout,
          fontSize: 9,
        });
      });

      content.push({
        text: `Total geral: ${filtered.length} viagem(ns) — ${formatBRL(grandTotal)}`,
        style: "total",
        margin: [0, 16, 0, 0],
      });

      const docDefinition = buildPdfDoc({
        title: "Relatório de Viagens",
        subtitle: periodo,
        content,
        orientation: "landscape",
      });

      await previewPdf(
        docDefinition,
        `relatorio-viagens-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <RouteIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Viagens</h2>
          <p className="text-sm text-muted-foreground">Histórico completo de transportes registrados.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={generatePDF}>
            <FileDown className="mr-1 h-4 w-4" /> Gerar PDF
          </Button>
          <Dialog
            open={open && !editing}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="lg"
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Nova viagem
              </Button>
            </DialogTrigger>
            <TripDialog
              key={`new-${formKey}`}
              trip={null}
              onSaved={() => {
                setOpen(false);
                setEditing(null);
                setFormKey((k) => k + 1);
              }}
            />
          </Dialog>
          <Dialog
            open={open && !!editing}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(null);
            }}
          >
            {editing && (
              <EditTripDialog
                key={`edit-${editing.id}-${formKey}`}
                trip={editing}
                onSaved={() => {
                  setOpen(false);
                  setEditing(null);
                  setFormKey((k) => k + 1);
                }}
              />
            )}
          </Dialog>
        </div>
      </div>

      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <Label className="text-xs">Caminhão</Label>
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
          </div>
          <div>
            <Label className="text-xs">Motorista</Label>
            <Select value={driverFilter} onValueChange={setDriverFilter}>
              <SelectTrigger className="w-52">
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
            <Label className="text-xs">Destino</Label>
            <Select
              value={destFilter}
              onValueChange={(v) => setDestFilter(v as typeof destFilter)}
            >
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="bataguassu">{DESTINATION_LABELS.bataguassu}</SelectItem>
                <SelectItem value="cassilandia">{DESTINATION_LABELS.cassilandia}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas</SelectItem>
                <SelectItem value="aberto">Em aberto</SelectItem>
                <SelectItem value="pago">Pagas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(dateFrom ||
            dateTo ||
            driverFilter !== "__all__" ||
            truckFilter !== "__all__" ||
            destFilter !== "__all__" ||
            statusFilter !== "__all__") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setDriverFilter("__all__");
                setTruckFilter("__all__");
                setDestFilter("__all__");
                setStatusFilter("__all__");
              }}
            >
              <X className="mr-1 h-3 w-3" /> Limpar
            </Button>
          )}
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">{sorted.length} viagem(ns)</p>
            <p className="text-lg font-bold text-primary">{formatBRL(totalValue)}</p>
          </div>
        </div>
      </Card>

      {trucks.length === 0 || !hasCurrentTable ? (
        <Card className="p-6 shadow-soft">
          <p className="font-semibold">Antes de registrar viagens:</p>
          <ul className="mt-2 list-disc pl-6 text-sm text-muted-foreground">
            {trucks.length === 0 && (
              <li>
                Cadastre ao menos um{" "}
                <Link to="/cadastros" className="text-primary underline">
                  caminhão
                </Link>
                .
              </li>
            )}
            {!hasCurrentTable && (
              <li>
                Configure a{" "}
                <Link to="/configuracoes" className="text-primary underline">
                  tabela de preços
                </Link>
                .
              </li>
            )}
          </ul>
        </Card>
      ) : null}

      {sorted.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nenhuma viagem registrada.</Card>
      ) : (
        <div className="space-y-3">
          {paged.map((t) => {
            const truck = trucks.find((x) => x.id === t.truckId);
            const driver = drivers.find((x) => x.id === t.driverId);
            const km = getDistance(t);
            const locked = lockedTripIds.has(t.id);
            return (
              <Card key={t.id} className="p-5 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={t.cattleType === "gordo" ? "default" : "secondary"}>
                        Gado {t.cattleType}
                      </Badge>
                      {t.destination && (
                        <Badge variant="outline">{DESTINATION_LABELS[t.destination]}</Badge>
                      )}
                      {(() => {
                        const tbl = tables.find((x) => x.id === t.priceTableId);
                        const name = tbl?.name ?? t.priceTableName;
                        return name ? (
                          <Badge variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ) : null;
                      })()}
                      {locked && (
                        <Badge variant="outline" className="border-amber-500 text-amber-600">
                          <Lock className="mr-1 h-3 w-3" /> Em recebimento
                        </Badge>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDateBR(t.date)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TruckIcon className="h-3 w-3" />
                        {truck?.name ?? "—"} ({truck?.plate ?? "—"})
                      </span>
                      {driver && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <UserIcon className="h-3 w-3" />
                          {driver.name}
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-2 text-lg font-semibold">
                      <MapPin className="h-4 w-4 text-accent" />
                      {t.origin} <span className="text-muted-foreground">→</span>{" "}
                      {t.destination ? DESTINATION_LABELS[t.destination] : t.destination}
                    </p>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      <span>{km.toLocaleString("pt-BR")} km</span>
                      <span>Tabela: {formatBRL(t.tableValue)}</span>
                      {t.lostAnimals > 0 && (
                        <span className="text-destructive">
                          {t.lostAnimals} perdido(s) × {formatBRL(t.lostAnimalValue)}
                        </span>
                      )}
                    </div>
                    <AttachmentsList items={t.attachments} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">
                        Valor final
                      </p>
                      <p className="text-2xl font-bold text-primary">{formatBRL(t.finalValue)}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={locked}
                      title={locked ? "Viagem em recebimento" : "Editar"}
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
                          setJsonEditTrip(t);
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
                      title={locked ? "Viagem em recebimento" : "Arquivar"}
                      onClick={() => archive(t.id)}
                    >
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={locked}
                      title={locked ? "Viagem em recebimento" : "Excluir"}
                      onClick={() => remove(t.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          <Pagination page={safePage} totalPages={totalPages} onChange={setPage} />
        </div>
      )}

      <JsonEditorDialog
        open={jsonEditOpen}
        onOpenChange={setJsonEditOpen}
        title={`Editar viagem — ${jsonEditTrip?.origin ?? ""}`}
        data={jsonEditTrip}
        onSave={(updated) => {
          if (jsonEditTrip && updated && typeof updated === "object") {
            setTrips((prev) =>
              prev.map((t) =>
                t.id === jsonEditTrip.id ? (updated as Trip) : t,
              ),
            );
          }
        }}
      />
    </div>
  );
}

const WIZARD_STEPS = [
  "Gado & Motorista",
  "Rota & Documentos",
  "Distância",
  "Valores & Finalização",
];

function ArchivedTripsSection() {
  const [allTrips, setTrips] = useTrips();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const archived = useMemo(
    () => allTrips.filter((t) => t.archived).sort((a, b) => b.date.localeCompare(a.date)),
    [allTrips],
  );

  const unarchive = (id: string) => {
    setTrips((prev) => prev.map((t) => (t.id === id ? { ...t, archived: false } : t)));
    toast.success("Viagem desarquivada");
  };

  const remove = (id: string) => {
    if (!window.confirm("Excluir definitivamente esta viagem arquivada?")) return;
    setTrips((prev) => prev.filter((t) => t.id !== id));
    toast.success("Viagem removida");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Viagens arquivadas</h2>
        <p className="text-sm text-muted-foreground">
          Viagens arquivadas não aparecem em recebimentos, relatórios nem nas demais telas.
        </p>
      </div>
      {archived.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">Nenhuma viagem arquivada.</Card>
      ) : (
        <div className="space-y-3">
          {archived.map((t) => {
            const truck = trucks.find((x) => x.id === t.truckId);
            const driver = drivers.find((x) => x.id === t.driverId);
            return (
              <Card key={t.id} className="p-4 shadow-soft">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        <Archive className="mr-1 h-3 w-3" /> Arquivada
                      </Badge>
                      {t.destination && (
                        <Badge variant="outline">{DESTINATION_LABELS[t.destination]}</Badge>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {formatDateBR(t.date)}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <TruckIcon className="h-3 w-3" />
                        {truck?.name ?? "—"}
                      </span>
                      {driver && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <UserIcon className="h-3 w-3" />
                          {driver.name}
                        </span>
                      )}
                    </div>
                    <p className="flex items-center gap-2 font-semibold">
                      <MapPin className="h-4 w-4 text-accent" />
                      {t.origin} <span className="text-muted-foreground">→</span>{" "}
                      {t.destination ? DESTINATION_LABELS[t.destination] : "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-lg font-bold text-primary">{formatBRL(t.finalValue)}</p>
                    <Button variant="outline" size="sm" onClick={() => unarchive(t.id)}>
                      <ArchiveRestore className="mr-1 h-4 w-4" /> Desarquivar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Excluir"
                      onClick={() => remove(t.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TripDialog({ trip, onSaved }: { trip: Trip | null; onSaved: () => void }) {
  const [, setTrips] = useTrips();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const [tables] = usePriceTables();
  const [tolls, setTolls] = useTolls();

  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.active || d.id === trip?.driverId),
    [drivers, trip?.driverId],
  );

  const tablesByDest = useMemo(() => {
    const map = new Map<Destination, PriceTable[]>();
    for (const t of tables) {
      const arr = map.get(t.destination) ?? [];
      arr.push(t);
      map.set(t.destination, arr);
    }
    return map;
  }, [tables]);

  const [step, setStep] = useState(0);

  const [date, setDate] = useState(
    trip?.date.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [truckId, setTruckId] = useState(trip?.truckId ?? trucks[0]?.id ?? "");
  const [driverId, setDriverId] = useState(trip?.driverId ?? availableDrivers[0]?.id ?? "");
  const [origin, setOrigin] = useState(trip?.origin ?? "");
  const [destination, setDestination] = useState<Destination>(trip?.destination ?? "bataguassu");
  const [pecuarista, setPecuarista] = useState(trip?.pecuarista ?? "");
  const [cattleType, setCattleType] = useState<CattleType>(trip?.cattleType ?? "gordo");
  const [cte, setCte] = useState(trip?.cte ?? "");
  const [minuta, setMinuta] = useState(trip?.minuta ?? "");

  const destTables = tablesByDest.get(destination) ?? [];
  const atualTable = destTables.find((t) => t.name === "ATUAL");
  const [priceTableId, setPriceTableId] = useState<string>(
    trip?.priceTableId ?? atualTable?.id ?? "",
  );

  const tripHasKm = !!trip && (trip.kmStart > 0 || trip.kmEnd > 0);
  const [kmStart, setKmStart] = useState(tripHasKm ? String(trip!.kmStart) : "");
  const [kmEnd, setKmEnd] = useState(tripHasKm ? String(trip!.kmEnd) : "");
  const [manualDistance, setManualDistance] = useState(
    trip?.manualDistance ? String(trip.manualDistance) : "",
  );
  const [lostAnimals, setLostAnimals] = useState(trip ? String(trip.lostAnimals) : "0");
  const [lostAnimalValue, setLostAnimalValue] = useState(trip ? String(trip.lostAnimalValue) : "0");
  const [manualValue, setManualValue] = useState(
    trip?.cattleType === "magro" ? String(trip.manualValue ?? trip.tableValue) : "",
  );
  const [attachments, setAttachments] = useState<Attachment[]>(trip?.attachments ?? []);
  const [linkedTollIds, setLinkedTollIds] = useState<Set<string>>(
    () => new Set(tolls.filter((t) => trip && t.tripId === trip.id).map((t) => t.id)),
  );

  const onDestinationChange = (dest: Destination) => {
    setDestination(dest);
    const destTabs = tablesByDest.get(dest) ?? [];
    const atual = destTabs.find((t) => t.name === "ATUAL");
    setPriceTableId(atual?.id ?? "");
  };

  const availableTolls = useMemo(
    () =>
      tolls
        .filter((t) => {
          if (truckId && t.truckId && t.truckId !== truckId) return false;
          return !t.tripId || (trip && t.tripId === trip.id);
        })
        .sort((a, b) => b.dateTime.localeCompare(a.dateTime)),
    [tolls, truckId, trip],
  );

  const toggleToll = (id: string) => {
    setLinkedTollIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasKm = kmStart !== "" && kmEnd !== "";
  const km = hasKm
    ? Math.max(0, Number(kmEnd) - Number(kmStart))
    : Math.max(0, Number(manualDistance) || 0);

  const selectedTable = destTables.find((t) => t.id === priceTableId);
  const tableValue = calculateTripValue(
    selectedTable,
    cattleType,
    km,
    cattleType === "magro" ? Number(manualValue) || 0 : undefined,
  );
  const lossTotal = Number(lostAnimals) * Number(lostAnimalValue);
  const finalValue = Math.max(0, tableValue - lossTotal);

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!truckId) return "Selecione o caminhão.";
      if (!cattleType) return "Selecione o tipo de gado.";
      return null;
    }
    if (s === 1) {
      if (!date) return "Informe a data.";
      if (!origin.trim()) return "Informe o local de embarque.";
      if (!destination) return "Selecione o local de desembarque.";
      return null;
    }
    if (s === 2) {
      if (!hasKm && !manualDistance) return "Informe Km inicial/final ou a distância manual.";
      if (hasKm && Number(kmEnd) <= Number(kmStart))
        return "Km final deve ser maior que o inicial.";
      return null;
    }
    if (s === 3) {
      if (cattleType === "magro" && (!manualValue || Number(manualValue) <= 0))
        return "Informe o valor manual para gado magro.";
      if (cattleType === "gordo" && !priceTableId) return "Selecione a tabela de referência.";
      return null;
    }
    return null;
  };

  const next = () => {
    const err = validateStep(step);
    if (err) {
      toast.error(err);
      return;
    }
    setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent Enter-key from submitting on any step except the last.
    // On non-final steps, advance the wizard instead of saving.
    if (step < WIZARD_STEPS.length - 1) {
      const err = validateStep(step);
      if (err) {
        toast.error(err);
        return;
      }
      setStep((s) => Math.min(s + 1, WIZARD_STEPS.length - 1));
      return;
    }
    const err = validateStep(3);
    if (err) {
      toast.error(err);
      setStep(3);
      return;
    }
    if (cattleType === "gordo" && tableValue === 0) {
      toast.warning("Nenhuma faixa de preço cobre essa distância. Verifique a tabela.");
    }

    const nextTrip: Trip = {
      id: trip?.id ?? uid(),
      date,
      truckId,
      driverId: driverId || undefined,
      origin: origin.trim(),
      destination,
      pecuarista: pecuarista.trim() || undefined,
      cattleType,
      cte: cte.trim() || undefined,
      minuta: minuta.trim() || undefined,
      kmStart: hasKm ? Number(kmStart) : 0,
      kmEnd: hasKm ? Number(kmEnd) : 0,
      manualDistance: hasKm ? undefined : Number(manualDistance) || 0,
      lostAnimals: Number(lostAnimals),
      lostAnimalValue: Number(lostAnimalValue),
      priceTableId: selectedTable?.id,
      priceTableName: selectedTable?.name,
      manualValue: cattleType === "magro" ? Number(manualValue) || 0 : undefined,
      tableValue,
      finalValue,
      attachments,
    };
    setTrips((prev) =>
      trip ? prev.map((p) => (p.id === trip.id ? nextTrip : p)) : [...prev, nextTrip],
    );
    setTolls((prev) =>
      prev.map((tl) => {
        const wasLinked = trip ? tl.tripId === trip.id : false;
        const isLinked = linkedTollIds.has(tl.id);
        if (isLinked) return { ...tl, tripId: nextTrip.id };
        if (wasLinked) return { ...tl, tripId: undefined };
        return tl;
      }),
    );
    toast.success(trip ? "Viagem atualizada" : `Viagem registrada — ${formatBRL(finalValue)}`);
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{trip ? "Editar viagem" : "Registrar viagem"}</DialogTitle>
      </DialogHeader>

      {/* Stepper */}
      <div className="flex items-center gap-1 pb-2">
        {WIZARD_STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-1">
            <div
              className={
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors " +
                (i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground")
              }
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span
              className={
                "hidden text-xs sm:inline " +
                (i <= step ? "text-foreground font-medium" : "text-muted-foreground")
              }
            >
              {label}
            </span>
            {i < WIZARD_STEPS.length - 1 && (
              <div
                className={"mx-1 h-0.5 flex-1 rounded " + (i < step ? "bg-primary" : "bg-muted")}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {/* Step 0: Gado & Motorista */}
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>
                Tipo de gado <span className="text-destructive">*</span>
              </Label>
              <Select value={cattleType} onValueChange={(v) => setCattleType(v as CattleType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="magro">Magro (valor manual)</SelectItem>
                  <SelectItem value="gordo">Gordo (tabela)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                {cattleType === "gordo"
                  ? "Gado gordo: o valor é calculado pela tabela de preços conforme a distância."
                  : "Gado magro: o valor é inserido manualmente na última etapa."}
              </p>
            </div>
            <div>
              <Label>
                Caminhão <span className="text-destructive">*</span>
              </Label>
              <Select value={truckId} onValueChange={setTruckId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {trucks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name} ({t.plate})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motorista</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={availableDrivers.length ? "Selecione" : "Nenhum cadastrado"}
                  />
                </SelectTrigger>
                <SelectContent>
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
        )}

        {/* Step 1: Rota & Documentos */}
        {step === 1 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>
                Data <span className="text-destructive">*</span>
              </Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>
                Local de embarque <span className="text-destructive">*</span>
              </Label>
              <Input
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                placeholder="Fazenda / Cidade"
              />
            </div>
            <div>
              <Label>
                Local de desembarque <span className="text-destructive">*</span>
              </Label>
              <Select
                value={destination}
                onValueChange={(v) => onDestinationChange(v as Destination)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cassilandia">Cassilândia</SelectItem>
                  <SelectItem value="bataguassu">Bataguassu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Pecuarista</Label>
              <Input
                value={pecuarista}
                onChange={(e) => setPecuarista(e.target.value)}
                placeholder="Nome do cliente/pecuarista"
              />
            </div>
            <div>
              <Label>CTe</Label>
              <Input
                value={cte}
                onChange={(e) => setCte(e.target.value)}
                placeholder="Número do CTe"
              />
            </div>
            <div>
              <Label>Minuta</Label>
              <Input
                value={minuta}
                onChange={(e) => setMinuta(e.target.value)}
                placeholder="Número da minuta"
              />
            </div>
          </div>
        )}

        {/* Step 2: Distância */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="mb-3 text-sm text-muted-foreground">
                Informe a distância percorrida. Você pode usar o hodômetro (Km inicial e final) ou
                digitar a distância manualmente.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Km inicial</Label>
                <Input
                  type="number"
                  value={kmStart}
                  onChange={(e) => {
                    setKmStart(e.target.value);
                    if (e.target.value) setManualDistance("");
                  }}
                  placeholder="Hodômetro inicial"
                />
              </div>
              <div>
                <Label>Km final</Label>
                <Input
                  type="number"
                  value={kmEnd}
                  onChange={(e) => {
                    setKmEnd(e.target.value);
                    if (e.target.value) setManualDistance("");
                  }}
                  placeholder="Hodômetro final"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div>
              <Label>Distância manual (km)</Label>
              <Input
                type="number"
                min="0"
                value={manualDistance}
                onChange={(e) => {
                  setManualDistance(e.target.value);
                  if (e.target.value) {
                    setKmStart("");
                    setKmEnd("");
                  }
                }}
                placeholder="Distância total percorrida"
                disabled={hasKm}
              />
            </div>
            {km > 0 && (
              <div className="rounded-lg border border-border bg-secondary/50 p-3 text-center">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Distância calculada
                </p>
                <p className="text-2xl font-bold text-primary">{km.toLocaleString("pt-BR")} km</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Valores & Finalização */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {cattleType === "gordo" && (
                <div className="sm:col-span-2">
                  <Label>
                    Tabela de referência <span className="text-destructive">*</span>
                  </Label>
                  <Select value={priceTableId} onValueChange={setPriceTableId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a tabela" />
                    </SelectTrigger>
                    <SelectContent>
                      {destTables
                        .slice()
                        .sort((a, b) => {
                          if (a.name === "ATUAL") return -1;
                          if (b.name === "ATUAL") return 1;
                          return b.createdAt.localeCompare(a.createdAt);
                        })
                        .map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name === "ATUAL" ? "ATUAL (atual)" : t.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {destTables.length === 0 && (
                    <p className="mt-1 text-xs text-destructive">
                      Nenhuma tabela para {DESTINATION_LABELS[destination]}. Configure em
                      Configurações.
                    </p>
                  )}
                </div>
              )}
              {cattleType === "magro" && (
                <div className="sm:col-span-2">
                  <Label>
                    Valor da viagem (R$) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={manualValue}
                    onChange={(e) => setManualValue(e.target.value)}
                    placeholder="Digite o valor manual"
                  />
                </div>
              )}
              <div>
                <Label>Animais perdidos</Label>
                <Input
                  type="number"
                  min="0"
                  value={lostAnimals}
                  onChange={(e) => setLostAnimals(e.target.value)}
                />
              </div>
              <div>
                <Label>Valor por animal perdido (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={lostAnimalValue}
                  onChange={(e) => setLostAnimalValue(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-secondary/50 p-4">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Summary label="Distância" value={`${km.toLocaleString("pt-BR")} km`} />
                <Summary label="Tabela" value={formatBRL(tableValue)} />
                <Summary label="Desconto" value={`- ${formatBRL(lossTotal)}`} />
                <Summary label="Valor final" value={formatBRL(finalValue)} highlight />
              </div>
            </div>

            <div>
              <AttachmentsField
                value={attachments}
                onChange={setAttachments}
                label="Anexos (romaneio, fotos...)"
              />
            </div>

            <div className="space-y-2">
              <Label>Pedágios da viagem</Label>
              {availableTolls.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Nenhum pedágio disponível{truckId ? " para este caminhão" : ""}. Cadastre em
                  Despesas → Pedágios.
                </p>
              ) : (
                <div className="max-h-48 overflow-y-auto rounded-md border border-border">
                  {availableTolls.map((tl) => {
                    const checked = linkedTollIds.has(tl.id);
                    return (
                      <label
                        key={tl.id}
                        htmlFor={`toll-${tl.id}`}
                        className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-muted/40"
                      >
                        <Checkbox
                          id={`toll-${tl.id}`}
                          checked={checked}
                          onCheckedChange={() => toggleToll(tl.id)}
                        />
                        <span className="flex-1 text-sm">
                          {tl.tollName}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {new Date(tl.dateTime).toLocaleString("pt-BR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                            {tl.semParar ? " • Sem Parar" : ""}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-primary">
                          {formatBRL(tl.value)}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={back} disabled={step === 0}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Etapa {step + 1} de {WIZARD_STEPS.length}
          </div>
          {step < WIZARD_STEPS.length - 1 ? (
            <Button type="button" onClick={next}>
              Próximo <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button type="submit" size="lg">
              <Check className="mr-1 h-4 w-4" /> {trip ? "Salvar alterações" : "Salvar viagem"}
            </Button>
          )}
        </div>
      </form>
    </DialogContent>
  );
}

function Summary({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={highlight ? "text-lg font-bold text-primary" : "font-semibold text-foreground"}>
        {value}
      </p>
    </div>
  );
}

function EditTripDialog({ trip, onSaved }: { trip: Trip; onSaved: () => void }) {
  const [, setTrips] = useTrips();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const [tables] = usePriceTables();

  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.active || d.id === trip.driverId),
    [drivers, trip.driverId],
  );

  const destTables = useMemo(
    () =>
      tables
        .filter((t) => t.destination === trip.destination)
        .sort((a, b) => {
          if (a.name === "ATUAL") return -1;
          if (b.name === "ATUAL") return 1;
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [tables, trip.destination],
  );

  const [truckId, setTruckId] = useState(trip.truckId);
  const [driverId, setDriverId] = useState(trip.driverId ?? "");
  const [cte, setCte] = useState(trip.cte ?? "");
  const [minuta, setMinuta] = useState(trip.minuta ?? "");
  const [pecuarista, setPecuarista] = useState(trip.pecuarista ?? "");
  const [priceTableId, setPriceTableId] = useState(trip.priceTableId ?? "");
  const [lostAnimals, setLostAnimals] = useState(String(trip.lostAnimals));
  const [lostAnimalValue, setLostAnimalValue] = useState(String(trip.lostAnimalValue));
  const [manualValue, setManualValue] = useState(
    trip.cattleType === "magro" ? String(trip.manualValue ?? trip.tableValue) : "",
  );
  const [attachments, setAttachments] = useState<Attachment[]>(trip.attachments ?? []);

  const selectedTable = destTables.find((t) => t.id === priceTableId);
  const km = getDistance(trip);
  const tableValue = calculateTripValue(
    selectedTable,
    trip.cattleType,
    km,
    trip.cattleType === "magro" ? Number(manualValue) || 0 : undefined,
  );
  const lossTotal = Number(lostAnimals) * Number(lostAnimalValue);
  const finalValue = Math.max(0, tableValue - lossTotal);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckId) {
      toast.error("Selecione o caminhão.");
      return;
    }
    if (trip.cattleType === "gordo" && !priceTableId) {
      toast.error("Selecione a tabela de referência.");
      return;
    }
    if (trip.cattleType === "magro" && (!manualValue || Number(manualValue) <= 0)) {
      toast.error("Informe o valor da viagem.");
      return;
    }

    const updated: Trip = {
      ...trip,
      truckId,
      driverId: driverId || undefined,
      cte: cte.trim() || undefined,
      minuta: minuta.trim() || undefined,
      pecuarista: pecuarista.trim() || undefined,
      priceTableId: selectedTable?.id,
      priceTableName: selectedTable?.name,
      lostAnimals: Number(lostAnimals),
      lostAnimalValue: Number(lostAnimalValue),
      manualValue: trip.cattleType === "magro" ? Number(manualValue) || 0 : undefined,
      tableValue,
      finalValue,
      attachments,
    };
    setTrips((prev) => prev.map((p) => (p.id === trip.id ? updated : p)));
    toast.success("Viagem atualizada");
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Editar viagem</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label>
              Caminhão <span className="text-destructive">*</span>
            </Label>
            <Select value={truckId} onValueChange={setTruckId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {trucks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({t.plate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motorista</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger>
                <SelectValue
                  placeholder={availableDrivers.length ? "Selecione" : "Nenhum cadastrado"}
                />
              </SelectTrigger>
              <SelectContent>
                {availableDrivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                    {!d.active ? " (inativo)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pecuarista</Label>
            <Input
              value={pecuarista}
              onChange={(e) => setPecuarista(e.target.value)}
              placeholder="Nome do cliente/pecuarista"
            />
          </div>
          <div>
            <Label>CTe</Label>
            <Input value={cte} onChange={(e) => setCte(e.target.value)} placeholder="Número do CTe" />
          </div>
          <div>
            <Label>Minuta</Label>
            <Input
              value={minuta}
              onChange={(e) => setMinuta(e.target.value)}
              placeholder="Número da minuta"
            />
          </div>
          {trip.cattleType === "gordo" && (
            <div className="sm:col-span-2">
              <Label>
                Tabela de referência <span className="text-destructive">*</span>
              </Label>
              <Select value={priceTableId} onValueChange={setPriceTableId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a tabela" />
                </SelectTrigger>
                <SelectContent>
                  {destTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name === "ATUAL" ? "ATUAL (atual)" : t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {destTables.length === 0 && (
                <p className="mt-1 text-xs text-destructive">
                  Nenhuma tabela para {DESTINATION_LABELS[trip.destination]}. Configure em
                  Configurações.
                </p>
              )}
            </div>
          )}
          {trip.cattleType === "magro" && (
            <div className="sm:col-span-2">
              <Label>
                Valor da viagem (R$) <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value)}
                placeholder="Digite o valor manual"
              />
            </div>
          )}
          <div>
            <Label>Animais perdidos</Label>
            <Input
              type="number"
              min="0"
              value={lostAnimals}
              onChange={(e) => setLostAnimals(e.target.value)}
            />
          </div>
          <div>
            <Label>Valor por animal perdido (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={lostAnimalValue}
              onChange={(e) => setLostAnimalValue(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Summary label="Distância" value={`${km.toLocaleString("pt-BR")} km`} />
            <Summary label="Tabela" value={formatBRL(tableValue)} />
            <Summary label="Desconto" value={`- ${formatBRL(lossTotal)}`} />
            <Summary label="Valor final" value={formatBRL(finalValue)} highlight />
          </div>
        </div>

        <div>
          <AttachmentsField
            value={attachments}
            onChange={setAttachments}
            label="Anexos (romaneio, fotos...)"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="submit" size="lg">
            <Check className="mr-1 h-4 w-4" /> Salvar alterações
          </Button>
        </div>
      </form>
    </DialogContent>
  );
}
