import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useMemo, type ReactNode } from "react";
import JSZip from "jszip";
import {
  usePriceTables,
  useTrucks,
  useTrips,
  useDrivers,
  useFuelings,
  useExpenses,
  useTolls,
  usePayments,
  useCommissionPayments,
  useDriverEntries,
  useSettings,
  uid,
  formatBRL,
  formatDateBR,
  type PriceTable,
  type PriceTier,
  type Destination,
  type Trip,
  type Truck,
  type Driver,
  type Fueling,
  type Expense,
  type Toll,
  type Payment,
  type CommissionPayment,
  type DriverEntry,
  DESTINATION_LABELS,
  DESTINATION_PREFIX,
} from "@/lib/storage";
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
  Trash2,
  Plus,
  Pencil,
  X,
  Download,
  Upload,
  Palette,
  Volume2,
  Play,
  HandCoins,
  HardDrive,
  Table2,
  History,
  Save,
  Lock,
  Archive,
  Code2,
  Settings as SettingsIcon,
  ChevronLeft,
  Truck as TruckIcon,
  Route as RouteIcon,
  Database,
  CloudUpload,
  AlertTriangle,
  Sun,
  Moon,
  Sparkles,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { JsonEditorDialog } from "@/components/JsonEditorDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useTheme, type AppTheme } from "@/lib/theme";
import { getDailyWord } from "@/lib/api/daily-word.functions";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Backup helpers
// ---------------------------------------------------------------------------

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>()),
  );
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(","));
  }
  return lines.join("\n");
}

function downloadBlob(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type ImportKey =
  | "trucks"
  | "drivers"
  | "priceTables"
  | "trips"
  | "fuelings"
  | "expenses"
  | "tolls"
  | "payments"
  | "commissionPayments"
  | "driverEntries";
const IMPORT_LABELS: Record<ImportKey, string> = {
  trucks: "Caminhões",
  drivers: "Motoristas",
  priceTables: "Tabelas de preços",
  trips: "Viagens",
  fuelings: "Combustíveis",
  expenses: "Manutenção",
  tolls: "Pedágios",
  payments: "Recebimentos",
  commissionPayments: "Comissões",
  driverEntries: "Lançamentos",
};

type WipeKey =
  | "trips"
  | "fuelings"
  | "expenses"
  | "tolls"
  | "payments"
  | "trucks"
  | "drivers"
  | "priceTables"
  | "commissionPayments"
  | "driverEntries";
const WIPE_LABELS: Record<WipeKey, string> = {
  trips: "Viagens",
  fuelings: "Combustíveis",
  expenses: "Manutenção",
  tolls: "Pedágios",
  payments: "Recebimentos",
  trucks: "Caminhões",
  drivers: "Motoristas",
  priceTables: "Tabelas de preços",
  commissionPayments: "Comissões",
  driverEntries: "Lançamentos",
};

const WORDLE_URL = "https://www.nytimes.com/games/wordle/index.html";

function fmtDate(s: string) {
  return formatDateBR(s.slice(0, 10));
}

function describeRecord(k: ImportKey | WipeKey, r: Record<string, unknown>): string {
  const id = String(r.id ?? "");
  const short = id.slice(-4);
  const brl = (n: unknown) => (typeof n === "number" ? formatBRL(n) : "");
  switch (k) {
    case "trips": {
      const date = typeof r.date === "string" ? fmtDate(r.date) : "";
      return `${date} · ${r.origin ?? "?"} → ${r.destination ?? "?"} · ${brl(r.finalValue)}`;
    }
    case "fuelings": {
      const date = typeof r.date === "string" ? fmtDate(r.date) : "";
      return `${date} · hod. ${r.odometer ?? "?"} · #${short}`;
    }
    case "expenses": {
      const date = typeof r.date === "string" ? fmtDate(r.date) : "";
      return `${date} · ${r.category ?? ""} · ${r.description ?? ""} · ${brl(r.value)}`;
    }
    case "tolls": {
      const dt = typeof r.dateTime === "string" ? fmtDate(r.dateTime) : "";
      return `${dt} · ${r.tollName ?? "?"} · ${brl(r.value)}`;
    }
    case "commissionPayments": {
      const date = typeof r.date === "string" ? fmtDate(r.date) : "";
      return `${date} · ${brl(r.paidAmount)} · #${short}`;
    }
    case "driverEntries": {
      const date = typeof r.date === "string" ? fmtDate(r.date) : "";
      return `${date} · ${r.type ?? ""} · ${brl(r.amount)}`;
    }
    case "payments": {
      const date = typeof r.date === "string" ? fmtDate(r.date) : "";
      return `${date} · ${brl(r.receivedValue)} · #${short}`;
    }
    case "trucks":
      return `${r.name ?? ""} (${r.plate ?? ""})`;
    case "drivers":
      return `${r.name ?? ""}`;
    case "priceTables":
      return `${r.destination ?? ""} · ${r.name ?? ""} · ${(r.tiers as unknown[] | undefined)?.length ?? 0} faixas`;
    default:
      return `#${short}`;
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Boiada" },
      { name: "description", content: "Tabelas de preços, backup e aparência." },
    ],
  }),
  component: ConfigPage,
});

type SectionKey = "tabelas" | "historico" | "backup" | "aparencia";

const NAV_ITEMS: {
  key: SectionKey;
  label: string;
  icon: typeof Table2;
  desc: string;
}[] = [
  {
    key: "tabelas",
    label: "Tabelas de preços",
    icon: Table2,
    desc: "Faixas de quilometragem e valores",
  },
  {
    key: "historico",
    label: "Histórico",
    icon: History,
    desc: "Versões arquivadas das tabelas",
  },
  {
    key: "backup",
    label: "Backup",
    icon: Database,
    desc: "Exportar, importar e limpar dados",
  },
  {
    key: "aparencia",
    label: "Aparência",
    icon: Palette,
    desc: "Tema, sons e preferências",
  },
];

function ConfigPage() {
  const [section, setSection] = useState<SectionKey>("tabelas");
  const active = NAV_ITEMS.find((n) => n.key === section)!;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Page header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie tabelas, backups e preferências do aplicativo.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Sidebar nav */}
        <nav className="md:sticky md:top-6 md:self-start">
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:flex-col md:overflow-visible md:pb-0">
            {NAV_ITEMS.map((item) => {
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
                  {isActive && <CircleDot className="ml-auto hidden h-4 w-4 text-primary md:block" />}
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
          {section === "tabelas" && <PriceTablesSection />}
          {section === "historico" && <HistorySection />}
          {section === "backup" && <BackupSection />}
          {section === "aparencia" && <AppearanceSection />}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared section shell
// ---------------------------------------------------------------------------

function SectionShell({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: typeof Table2;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TABELAS DE PREÇOS
// ---------------------------------------------------------------------------

function PriceTablesSection() {
  const [tables, setTables] = usePriceTables();
  const [settings] = useSettings();
  const [activeDest, setActiveDest] = useState<Destination>("bataguassu");
  const [jsonEditOpen, setJsonEditOpen] = useState(false);
  const [jsonEditTable, setJsonEditTable] = useState<PriceTable | null>(null);

  const currentTable = useMemo(
    () => tables.find((t) => t.destination === activeDest && t.name === "ATUAL"),
    [tables, activeDest],
  );

  const [fromKm, setFromKm] = useState("");
  const [toKm, setToKm] = useState("");
  const [value, setValue] = useState("");
  const [editingTierId, setEditingTierId] = useState<string | null>(null);

  const [perKmEnabled, setPerKmEnabled] = useState(currentTable?.perKm.enabled ?? false);
  const [perKmFrom, setPerKmFrom] = useState(currentTable ? String(currentTable.perKm.fromKm) : "");
  const [perKmValue, setPerKmValue] = useState(
    currentTable ? String(currentTable.perKm.perKmValue) : "",
  );

  useMemo(() => {
    if (currentTable) {
      setPerKmEnabled(currentTable.perKm.enabled);
      setPerKmFrom(String(currentTable.perKm.fromKm));
      setPerKmValue(String(currentTable.perKm.perKmValue));
    }
  }, [currentTable?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateCurrentTable = (patch: Partial<PriceTable>) => {
    setTables((prev) => prev.map((t) => (t.id === currentTable?.id ? { ...t, ...patch } : t)));
  };

  const submitTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTable) return;
    const f = Number(fromKm);
    const t = Number(toKm);
    const v = Number(value);
    if (isNaN(f) || isNaN(t) || isNaN(v) || f < 0 || t <= f || v < 0) {
      toast.error("Valores inválidos. Verifique a faixa.");
      return;
    }
    const sortFn = (a: PriceTier, b: PriceTier) => a.fromKm - b.fromKm;
    const tiers = [...(currentTable.tiers || [])];
    if (editingTierId) {
      const idx = tiers.findIndex((x) => x.id === editingTierId);
      if (idx >= 0) tiers[idx] = { id: editingTierId, fromKm: f, toKm: t, value: v };
    } else {
      tiers.push({ id: uid(), fromKm: f, toKm: t, value: v });
    }
    tiers.sort(sortFn);
    updateCurrentTable({ tiers });
    toast.success(editingTierId ? "Faixa atualizada" : "Faixa adicionada");
    setFromKm("");
    setToKm("");
    setValue("");
    setEditingTierId(null);
  };

  const startEditTier = (tier: PriceTier) => {
    setEditingTierId(tier.id);
    setFromKm(String(tier.fromKm));
    setToKm(String(tier.toKm));
    setValue(String(tier.value));
  };

  const cancelEditTier = () => {
    setEditingTierId(null);
    setFromKm("");
    setToKm("");
    setValue("");
  };

  const removeTier = (id: string) => {
    updateCurrentTable({
      tiers: (currentTable?.tiers || []).filter((t) => t.id !== id),
    });
    if (editingTierId === id) cancelEditTier();
  };

  const savePerKm = () => {
    if (!currentTable) return;
    updateCurrentTable({
      perKm: {
        enabled: perKmEnabled,
        fromKm: Number(perKmFrom) || 0,
        perKmValue: Number(perKmValue) || 0,
      },
    });
    toast.success("Configuração por km salva");
  };

  const generateNewAtual = () => {
    const hasAtual = tables.some((t) => t.destination === activeDest && t.name === "ATUAL");
    if (hasAtual) {
      toast.error(`Já existe uma tabela ATUAL para ${DESTINATION_LABELS[activeDest]}.`);
      return;
    }
    const lastArchived = tables
      .filter((t) => t.destination === activeDest && t.name !== "ATUAL")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const newTable: PriceTable = {
      id: uid(),
      destination: activeDest,
      name: "ATUAL",
      tiers: lastArchived ? lastArchived.tiers.map((t) => ({ ...t, id: uid() })) : [],
      perKm: lastArchived
        ? { ...lastArchived.perKm }
        : { enabled: false, fromKm: 0, perKmValue: 0 },
      createdAt: new Date().toISOString(),
    };
    setTables((prev) => [...prev, newTable]);
    toast.success(`Nova tabela ATUAL criada para ${DESTINATION_LABELS[activeDest]}.`);
  };

  const archiveTable = () => {
    if (!currentTable) return;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const prefix = DESTINATION_PREFIX[activeDest];
    const archiveName = `${prefix}_${today}`;

    const existing = tables.find((t) => t.destination === activeDest && t.name === archiveName);
    if (existing) {
      toast.error(`Já existe uma versão ${archiveName}. Renomeie ou apague-a primeiro.`);
      return;
    }

    setTables((prev) =>
      prev.map((t) => (t.id === currentTable.id ? { ...t, name: archiveName } : t)),
    );
    toast.success(`Tabela arquivada como ${archiveName}. Gere uma nova tabela ATUAL para continuar.`);
  };

  const sortedTiers = useMemo(
    () => (currentTable?.tiers ?? []).slice().sort((a, b) => a.fromKm - b.fromKm),
    [currentTable],
  );

  return (
    <SectionShell
      title="Tabelas de preços"
      description="Faixas de quilometragem e valores por destino."
      icon={Table2}
    >
      {/* Destination switcher */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-muted p-1">
            {(Object.keys(DESTINATION_LABELS) as Destination[]).map((dest) => (
              <button
                key={dest}
                onClick={() => setActiveDest(dest)}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                  activeDest === dest
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {DESTINATION_LABELS[dest]}
              </button>
            ))}
          </div>
          {currentTable && (
            <Button variant="outline" onClick={archiveTable} className="rounded-xl">
              <Archive className="mr-1.5 h-4 w-4" /> Arquivar tabela
            </Button>
          )}
        </div>
      </Panel>

      {!currentTable ? (
        <Panel className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <Table2 className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="mb-1 font-semibold text-foreground">
            Nenhuma tabela ATUAL para {DESTINATION_LABELS[activeDest]}
          </p>
          <p className="mb-4 text-sm text-muted-foreground">
            Crie uma tabela para começar a cadastrar viagens de gado gordo.
          </p>
          <Button onClick={generateNewAtual} className="mx-auto">
            <Plus className="mr-1.5 h-4 w-4" /> Gerar tabela ATUAL
          </Button>
        </Panel>
      ) : (
        <>
          {/* Tier form + header */}
          <Panel>
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold">
                  Tabela ATUAL — {DESTINATION_LABELS[activeDest]}
                </h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Gado gordo: faixas de km e valor. Gado magro: valor inserido manualmente na viagem.
                </p>
              </div>
              <div className="flex items-center gap-2">
                {settings.editorMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Editar JSON"
                    onClick={() => {
                      setJsonEditTable(currentTable);
                      setJsonEditOpen(true);
                    }}
                  >
                    <Code2 className="h-4 w-4" />
                  </Button>
                )}
                <Badge variant="secondary" className="rounded-full">
                  {sortedTiers.length} faixas
                </Badge>
              </div>
            </div>

            <form onSubmit={submitTier} className="grid gap-3 sm:grid-cols-4">
              <div>
                <Label className="mb-1.5">De (km)</Label>
                <Input
                  type="number"
                  value={fromKm}
                  onChange={(e) => setFromKm(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div>
                <Label className="mb-1.5">Até (km)</Label>
                <Input
                  type="number"
                  value={toKm}
                  onChange={(e) => setToKm(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div>
                <Label className="mb-1.5">Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="rounded-lg"
                />
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="w-full rounded-lg">
                  <Plus className="mr-1 h-4 w-4" /> {editingTierId ? "Salvar" : "Adicionar"}
                </Button>
                {editingTierId && (
                  <Button type="button" variant="ghost" onClick={cancelEditTier} className="rounded-lg">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </Panel>

          {/* Tier list */}
          {sortedTiers.length > 0 && (
            <Panel>
              <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Faixas cadastradas
              </h4>
              <ul className="divide-y divide-border">
                {sortedTiers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium text-foreground">
                        {t.fromKm} – {t.toKm} km
                      </p>
                      <p className="text-sm font-semibold text-primary">{formatBRL(t.value)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => startEditTier(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => removeTier(t.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Per-km config */}
          <Panel>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold">Valor por quilometragem</h3>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  A partir de X km, o valor da viagem = km × valor por km.
                </p>
              </div>
              <Checkbox
                checked={perKmEnabled}
                onCheckedChange={(v) => setPerKmEnabled(!!v)}
              />
            </div>
            {perKmEnabled && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label className="mb-1.5">A partir de (km)</Label>
                  <Input
                    type="number"
                    value={perKmFrom}
                    onChange={(e) => setPerKmFrom(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <Label className="mb-1.5">Valor por km (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={perKmValue}
                    onChange={(e) => setPerKmValue(e.target.value)}
                    className="rounded-lg"
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={savePerKm} className="w-full rounded-lg">
                    <Save className="mr-1 h-4 w-4" /> Salvar
                  </Button>
                </div>
              </div>
            )}
          </Panel>
        </>
      )}

      <JsonEditorDialog
        open={jsonEditOpen}
        onOpenChange={setJsonEditOpen}
        title={`Editar tabela ATUAL — ${DESTINATION_LABELS[activeDest]}`}
        data={jsonEditTable}
        onSave={(updated) => {
          if (jsonEditTable && updated && typeof updated === "object") {
            setTables((prev) =>
              prev.map((t) =>
                t.id === jsonEditTable.id ? ({ ...t, ...updated } as PriceTable) : t,
              ),
            );
          }
        }}
      />
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// HISTÓRICO
// ---------------------------------------------------------------------------

function HistorySection() {
  const [tables, setTables] = usePriceTables();

  const archived = useMemo(
    () =>
      tables
        .filter((t) => t.name !== "ATUAL")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [tables],
  );

  const removeTable = (id: string) => {
    if (!window.confirm("Excluir esta versão arquivada?")) return;
    setTables((prev) => prev.filter((t) => t.id !== id));
    toast.success("Versão removida");
  };

  return (
    <SectionShell
      title="Histórico de tabelas"
      description="Versões arquivadas. Viagens que as usaram mantêm os valores originais."
      icon={History}
    >
      {archived.length === 0 ? (
        <Panel className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <History className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Nenhuma versão arquivada.</p>
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {archived.map((t) => (
            <Panel key={t.id}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-base font-bold">{t.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {DESTINATION_LABELS[t.destination]} · {formatDateBR(t.createdAt)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeTable(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <div className="max-h-44 overflow-y-auto pr-1">
                {t.tiers.length > 0 ? (
                  <ul className="text-sm">
                    {t.tiers
                      .slice()
                      .sort((a, b) => a.fromKm - b.fromKm)
                      .map((tier) => (
                        <li
                          key={tier.id}
                          className="flex justify-between border-b border-border py-1.5 last:border-0"
                        >
                          <span className="text-muted-foreground">
                            {tier.fromKm} – {tier.toKm} km
                          </span>
                          <span className="font-semibold">{formatBRL(tier.value)}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Sem faixas (gado magro).</p>
                )}
                {t.perKm.enabled && (
                  <div className="mt-2 rounded-lg border border-border bg-muted/40 p-2.5 text-sm">
                    A partir de {t.perKm.fromKm} km: {formatBRL(t.perKm.perKmValue)}/km
                  </div>
                )}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// BACKUP
// ---------------------------------------------------------------------------

function BackupSection() {
  const [tables, setTables] = usePriceTables();
  const [trucks, setTrucks] = useTrucks();
  const [trips, setTrips] = useTrips();
  const [drivers, setDrivers] = useDrivers();
  const [fuelings, setFuelings] = useFuelings();
  const [expenses, setExpenses] = useExpenses();
  const [tolls, setTolls] = useTolls();
  const [payments, setPayments] = usePayments();
  const [commissionPayments, setCommissionPayments] = useCommissionPayments();
  const [driverEntries, setDriverEntries] = useDriverEntries();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportFormat, setExportFormat] = useState<"json" | "boiada">("json");
  const [importFormat, setImportFormat] = useState<"json" | "boiada">("json");

  const [importPayload, setImportPayload] = useState<Record<ImportKey, unknown[]> | null>(null);
  const [importSel, setImportSel] = useState<Record<ImportKey, boolean>>({
    trucks: true,
    drivers: true,
    priceTables: true,
    trips: true,
    fuelings: true,
    expenses: true,
    tolls: true,
    payments: true,
    commissionPayments: true,
    driverEntries: true,
  });
  const [importByRecord, setImportByRecord] = useState(false);
  const [importIds, setImportIds] = useState<Record<ImportKey, Set<string>>>({
    trucks: new Set(),
    drivers: new Set(),
    priceTables: new Set(),
    trips: new Set(),
    fuelings: new Set(),
    expenses: new Set(),
    tolls: new Set(),
    payments: new Set(),
    commissionPayments: new Set(),
    driverEntries: new Set(),
  });

  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeMode, setWipeMode] = useState<"geral" | "agressivo" | "escolher" | "especifico">(
    "geral",
  );
  const [wipeSel, setWipeSel] = useState<Record<WipeKey, boolean>>({
    trips: false,
    fuelings: false,
    expenses: false,
    tolls: false,
    payments: false,
    trucks: false,
    drivers: false,
    priceTables: false,
    commissionPayments: false,
    driverEntries: false,
  });
  const [wipeIds, setWipeIds] = useState<Record<WipeKey, Set<string>>>({
    trips: new Set(),
    fuelings: new Set(),
    expenses: new Set(),
    tolls: new Set(),
    payments: new Set(),
    trucks: new Set(),
    drivers: new Set(),
    priceTables: new Set(),
    commissionPayments: new Set(),
    driverEntries: new Set(),
  });
  const [wipeWord, setWipeWord] = useState<string | null>(null);
  const [wipeWordSource, setWipeWordSource] = useState<"nyt" | "fallback" | null>(null);
  const [wipeInput, setWipeInput] = useState("");
  const [wipeLoading, setWipeLoading] = useState(false);

  const exportData = (format: "json" | "boiada") => {
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      trucks,
      drivers,
      priceTables: tables,
      trips,
      fuelings,
      expenses,
      tolls,
      payments,
      commissionPayments,
      driverEntries,
    };
    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      downloadBlob(`boiada-backup-${new Date().toISOString().slice(0, 10)}.json`, blob);
      toast.success("Dados exportados (JSON)");
    } else {
      exportCSV(data);
    }
  };

  const exportCSV = async (backupData: Record<string, unknown>) => {
    const truckLabel = (id?: string) => {
      const tr = trucks.find((t) => t.id === id);
      return tr ? `${tr.name} (${tr.plate})` : "";
    };
    const driverLabel = (id?: string) => drivers.find((d) => d.id === id)?.name ?? "";
    const tripLabel = (id?: string) => {
      const t = trips.find((x) => x.id === id);
      return t ? `${formatDateBR(t.date)} ${t.origin}→${t.destination}` : "";
    };

    const files: { name: string; content: string }[] = [
      {
        name: "caminhoes.csv",
        content: toCSV(trucks.map((t) => ({ id: t.id, nome: t.name, placa: t.plate }))),
      },
      {
        name: "motoristas.csv",
        content: toCSV(
          drivers.map((d) => ({
            id: d.id,
            nome: d.name,
            telefone: d.phone ?? "",
            ativo: d.active ? "sim" : "nao",
          })),
        ),
      },
      {
        name: "tabelas-precos.csv",
        content: toCSV(
          tables.flatMap((tbl) =>
            tbl.tiers.map((t) => ({
              tabela: tbl.name,
              destino: tbl.destination,
              de_km: t.fromKm,
              ate_km: t.toKm,
              valor: t.value,
            })),
          ),
        ),
      },
      {
        name: "viagens.csv",
        content: toCSV(
          trips.map((t) => ({
            id: t.id,
            data: t.date.slice(0, 10),
            caminhao: truckLabel(t.truckId),
            motorista: driverLabel(t.driverId),
            origem: t.origin,
            destino: t.destination,
            gado: t.cattleType,
            km_inicial: t.kmStart,
            km_final: t.kmEnd,
            distancia_manual: t.manualDistance ?? "",
            km_total:
              t.kmStart > 0 || t.kmEnd > 0
                ? Math.max(0, t.kmEnd - t.kmStart)
                : (t.manualDistance ?? 0),
            animais_perdidos: t.lostAnimals,
            valor_por_animal: t.lostAnimalValue,
            valor_tabela: t.tableValue,
            valor_final: t.finalValue,
            anexos: t.attachments?.length ?? 0,
          })),
        ),
      },
      {
        name: "combustiveis.csv",
        content: toCSV(
          fuelings.flatMap((f) =>
            (f.items.length
              ? f.items
              : [{ kind: "combustivel", description: "", quantity: 0, unitPrice: 0 }]
            ).map((it) => ({
              id: f.id,
              data: f.date.slice(0, 10),
              caminhao: truckLabel(f.truckId),
              motorista: driverLabel(f.driverId),
              hodometro: f.odometer,
              tipo: it.kind,
              descricao: it.description,
              quantidade: it.quantity,
              valor_unitario: it.unitPrice,
              total_item: it.quantity * it.unitPrice,
              desconta_do_pagamento: f.deductFromPayment ? "sim" : "nao",
              anexos: f.attachments?.length ?? 0,
            })),
          ),
        ),
      },
      {
        name: "manutencao.csv",
        content: toCSV(
          expenses.map((e) => ({
            id: e.id,
            data: e.date.slice(0, 10),
            caminhao: truckLabel(e.truckId),
            motorista: driverLabel(e.driverId),
            categoria: e.category,
            descricao: e.description,
            valor: e.value,
            responsabilidade: e.responsibility,
            observacoes: e.notes ?? "",
            anexos: e.attachments?.length ?? 0,
          })),
        ),
      },
      {
        name: "pedagios.csv",
        content: toCSV(
          tolls.map((t) => ({
            id: t.id,
            data_hora: t.dateTime,
            pedagio: t.tollName,
            caminhao: truckLabel(t.truckId),
            motorista: driverLabel(t.driverId),
            viagem: tripLabel(t.tripId),
            valor: t.value,
            sem_parar: t.semParar ? "sim" : "nao",
            responsabilidade: t.responsibility,
            observacoes: t.notes ?? "",
            anexos: t.attachments?.length ?? 0,
          })),
        ),
      },
      {
        name: "recebimentos.csv",
        content: toCSV(
          payments.map((p) => ({
            id: p.id,
            data: p.date.slice(0, 10),
            viagens: p.tripIds.length,
            combustiveis: p.fuelingIds.length,
            manutencoes: p.expenseIds.length,
            pedagios: p.tollIds.length,
            bruto: p.grossValue,
            aluguel_carreta: p.rentValue,
            ressarcimentos: p.reimbursedValue,
            descontos: p.deductedValue,
            valor_esperado: p.expectedValue,
            valor_recebido: p.receivedValue,
            observacoes: p.notes ?? "",
          })),
        ),
      },
      {
        name: "comissoes.csv",
        content: toCSV(
          commissionPayments.map((c) => ({
            id: c.id,
            motorista: driverLabel(c.driverId),
            data: c.date,
            viagens: c.tripIds.length,
            comissao: c.commissionValue,
            vales: c.valesTotal,
            vale_descontado: c.valeDeducted,
            ajuda_custo: c.ajudaCusto,
            vales_restantes: c.remainingVales,
            excesso_vale: c.excessAsVale,
            valor_pago: c.paidAmount,
            finalizado: c.finalized ? "sim" : "nao",
          })),
        ),
      },
      {
        name: "lancamentos.csv",
        content: toCSV(
          driverEntries.map((e) => ({
            id: e.id,
            motorista: driverLabel(e.driverId),
            data: e.date,
            tipo: e.type,
            valor: e.amount,
            descricao: e.description ?? "",
          })),
        ),
      },
    ];

    const stamp = new Date().toISOString().slice(0, 10);
    const zip = new JSZip();
    let count = 0;
    for (const f of files) {
      if (!f.content) continue;
      zip.file(f.name, f.content);
      count++;
    }
    zip.file("backup.json", JSON.stringify(backupData, null, 2));
    if (count === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(`boiada-${stamp}.boiada`, blob);
    toast.success(`Arquivo .boiada exportado (${count} CSV + backup)`);
  };

  const openImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      let parsed: Record<string, unknown>;
      const lower = file.name.toLowerCase();
      const isZip = lower.endsWith(".boiada") || lower.endsWith(".zip");
      if (isZip) {
        const zip = await JSZip.loadAsync(file);
        const jsonEntry = zip.file("backup.json");
        if (!jsonEntry) {
          toast.error("Arquivo .boiada não contém backup.json");
          return;
        }
        parsed = JSON.parse(await jsonEntry.async("string"));
      } else {
        parsed = JSON.parse(await file.text());
      }
      const payload: Record<ImportKey, unknown[]> = {
        trucks: Array.isArray(parsed.trucks) ? (parsed.trucks as unknown[]) : [],
        drivers: Array.isArray(parsed.drivers) ? (parsed.drivers as unknown[]) : [],
        priceTables: Array.isArray(parsed.priceTables)
          ? (parsed.priceTables as unknown[])
          : Array.isArray(parsed.priceTiers)
            ? (parsed.priceTiers as unknown[])
            : [],
        trips: Array.isArray(parsed.trips) ? (parsed.trips as unknown[]) : [],
        fuelings: Array.isArray(parsed.fuelings) ? (parsed.fuelings as unknown[]) : [],
        expenses: Array.isArray(parsed.expenses) ? (parsed.expenses as unknown[]) : [],
        tolls: Array.isArray(parsed.tolls) ? (parsed.tolls as unknown[]) : [],
        payments: Array.isArray(parsed.payments) ? (parsed.payments as unknown[]) : [],
        commissionPayments: Array.isArray(parsed.commissionPayments)
          ? (parsed.commissionPayments as unknown[])
          : [],
        driverEntries: Array.isArray(parsed.driverEntries)
          ? (parsed.driverEntries as unknown[])
          : [],
      };
      const total = Object.values(payload).reduce((s, arr) => s + arr.length, 0);
      if (!total) {
        toast.error("Arquivo inválido ou vazio");
        return;
      }
      setImportPayload(payload);
      setImportSel({
        trucks: payload.trucks.length > 0,
        drivers: payload.drivers.length > 0,
        priceTables: payload.priceTables.length > 0,
        trips: payload.trips.length > 0,
        fuelings: payload.fuelings.length > 0,
        expenses: payload.expenses.length > 0,
        tolls: payload.tolls.length > 0,
        payments: payload.payments.length > 0,
        commissionPayments: payload.commissionPayments.length > 0,
        driverEntries: payload.driverEntries.length > 0,
      });
      setImportByRecord(false);
      setImportIds({
        trucks: new Set(),
        drivers: new Set(),
        priceTables: new Set(),
        trips: new Set(),
        fuelings: new Set(),
        expenses: new Set(),
        tolls: new Set(),
        payments: new Set(),
        commissionPayments: new Set(),
        driverEntries: new Set(),
      });
    } catch {
      toast.error("Erro ao ler o arquivo");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmImport = async () => {
    if (!importPayload) return;
    const selectedKeys = (Object.keys(importSel) as ImportKey[]).filter((k) => importSel[k]);
    if (!selectedKeys.length) {
      toast.error("Selecione ao menos uma categoria");
      return;
    }
    const toastId = toast.loading("Importando dados selecionados...");
    try {
      const has = (k: ImportKey) => selectedKeys.includes(k);
      const pick = <T extends { id: string }>(k: ImportKey, arr: T[]): T[] => {
        if (!importByRecord) return arr;
        const ids = importIds[k];
        return arr.filter((x) => ids.has(x.id));
      };
      const trucks_ = pick("trucks", importPayload.trucks as Truck[]);
      const drivers_ = pick("drivers", importPayload.drivers as Driver[]);
      const tables_ = pick("priceTables", importPayload.priceTables as PriceTable[]);
      const trips_ = pick("trips", importPayload.trips as Trip[]);
      const fuelings_ = pick("fuelings", importPayload.fuelings as Fueling[]);
      const expenses_ = pick("expenses", importPayload.expenses as Expense[]);
      const tolls_ = pick("tolls", importPayload.tolls as Toll[]);
      const payments_ = pick("payments", importPayload.payments as Payment[]);
      const commissionPayments_ = pick(
        "commissionPayments",
        importPayload.commissionPayments as CommissionPayment[],
      );
      const driverEntries_ = pick("driverEntries", importPayload.driverEntries as DriverEntry[]);

      const mergeById = <T extends { id: string }>(prev: T[], next: T[]): T[] => {
        const map = new Map(prev.map((x) => [x.id, x] as const));
        for (const n of next) map.set(n.id, n);
        return Array.from(map.values());
      };
      if (has("trucks")) setTrucks((p) => (importByRecord ? mergeById(p, trucks_) : trucks_));
      if (has("drivers")) setDrivers((p) => (importByRecord ? mergeById(p, drivers_) : drivers_));
      if (has("priceTables")) setTables((p) => (importByRecord ? mergeById(p, tables_) : tables_));
      if (has("trips")) setTrips((p) => (importByRecord ? mergeById(p, trips_) : trips_));
      if (has("fuelings"))
        setFuelings((p) => (importByRecord ? mergeById(p, fuelings_) : fuelings_));
      if (has("expenses"))
        setExpenses((p) => (importByRecord ? mergeById(p, expenses_) : expenses_));
      if (has("tolls")) setTolls((p) => (importByRecord ? mergeById(p, tolls_) : tolls_));
      if (has("payments"))
        setPayments((p) => (importByRecord ? mergeById(p, payments_) : payments_));
      if (has("commissionPayments"))
        setCommissionPayments((p) =>
          importByRecord ? mergeById(p, commissionPayments_) : commissionPayments_,
        );
      if (has("driverEntries"))
        setDriverEntries((p) => (importByRecord ? mergeById(p, driverEntries_) : driverEntries_));
      toast.success(`Importado: ${selectedKeys.map((k) => IMPORT_LABELS[k]).join(", ")}`);
      setImportPayload(null);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao importar");
    } finally {
      toast.dismiss(toastId);
    }
  };

  const openWipe = async () => {
    setWipeOpen(true);
    setWipeMode("geral");
    setWipeSel({
      trips: false,
      fuelings: false,
      expenses: false,
      tolls: false,
      payments: false,
      trucks: false,
      drivers: false,
      priceTables: false,
      commissionPayments: false,
      driverEntries: false,
    });
    setWipeIds({
      trips: new Set(),
      fuelings: new Set(),
      expenses: new Set(),
      tolls: new Set(),
      payments: new Set(),
      trucks: new Set(),
      drivers: new Set(),
      priceTables: new Set(),
      commissionPayments: new Set(),
      driverEntries: new Set(),
    });
    setWipeInput("");
    setWipeWord(null);
    setWipeWordSource(null);
    setWipeLoading(true);
    try {
      const res = await getDailyWord();
      setWipeWord(res.word);
      setWipeWordSource(res.source);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível obter a palavra do dia");
      setWipeOpen(false);
    } finally {
      setWipeLoading(false);
    }
  };

  const wipeTargets = (): Set<WipeKey> => {
    if (wipeMode === "geral") {
      return new Set<WipeKey>([
        "trips",
        "fuelings",
        "expenses",
        "tolls",
        "payments",
        "commissionPayments",
        "driverEntries",
      ]);
    }
    if (wipeMode === "agressivo") {
      return new Set<WipeKey>([
        "trips",
        "fuelings",
        "expenses",
        "tolls",
        "payments",
        "commissionPayments",
        "driverEntries",
        "trucks",
        "drivers",
        "priceTables",
      ]);
    }
    const s = new Set<WipeKey>();
    (Object.keys(wipeSel) as WipeKey[]).forEach((k) => {
      if (wipeSel[k]) s.add(k);
    });
    if (s.has("trips") || s.has("tolls") || s.has("fuelings") || s.has("expenses"))
      s.add("payments");
    return s;
  };

  const confirmWipe = () => {
    if (!wipeWord) return;
    if (wipeInput.trim().toLowerCase() !== wipeWord.toLowerCase()) {
      toast.error("Palavra incorreta");
      return;
    }
    if (wipeMode === "especifico") {
      const tripIds = wipeIds.trips;
      const tollIds = wipeIds.tolls;
      const fuelIds = wipeIds.fuelings;
      const expIds = wipeIds.expenses;
      const payIds = new Set(wipeIds.payments);
      const totalSel = tripIds.size + tollIds.size + fuelIds.size + expIds.size + payIds.size;
      if (totalSel === 0) {
        toast.error("Selecione ao menos um registro");
        return;
      }
      for (const p of payments) {
        if (
          p.tripIds.some((id) => tripIds.has(id)) ||
          p.tollIds.some((id) => tollIds.has(id)) ||
          p.fuelingIds.some((id) => fuelIds.has(id)) ||
          p.expenseIds.some((id) => expIds.has(id))
        )
          payIds.add(p.id);
      }
      if (tripIds.size) setTrips((prev) => prev.filter((t) => !tripIds.has(t.id)));
      if (tollIds.size) setTolls((prev) => prev.filter((t) => !tollIds.has(t.id)));
      if (fuelIds.size) setFuelings((prev) => prev.filter((f) => !fuelIds.has(f.id)));
      if (expIds.size) setExpenses((prev) => prev.filter((e) => !expIds.has(e.id)));
      if (payIds.size) setPayments((prev) => prev.filter((p) => !payIds.has(p.id)));
      toast.success(`Registros removidos: ${totalSel}`);
      setWipeOpen(false);
      return;
    }
    const t = wipeTargets();
    if (t.size === 0) {
      toast.error("Selecione ao menos uma categoria");
      return;
    }
    if (t.has("trips")) setTrips([]);
    if (t.has("fuelings")) setFuelings([]);
    if (t.has("expenses")) setExpenses([]);
    if (t.has("tolls")) setTolls([]);
    if (t.has("payments")) setPayments([]);
    if (t.has("commissionPayments")) setCommissionPayments([]);
    if (t.has("driverEntries")) setDriverEntries([]);
    if (t.has("trucks")) setTrucks([]);
    if (t.has("drivers")) setDrivers([]);
    if (t.has("priceTables")) setTables([]);
    toast.success(
      `Dados removidos: ${Array.from(t)
        .map((k) => WIPE_LABELS[k])
        .join(", ")}`,
    );
    setWipeOpen(false);
  };

  return (
    <SectionShell
      title="Backup de dados"
      description="Exporte, importe ou apague os dados da aplicação."
      icon={Database}
    >
      {/* Export / Import */}
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Download className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="font-semibold">Exportar</p>
                <p className="text-xs text-muted-foreground">Baixe todos os dados</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => exportData(exportFormat)} className="rounded-lg">
                <Download className="mr-1.5 h-4 w-4" /> Exportar
              </Button>
              <Select
                value={exportFormat}
                onValueChange={(v) => setExportFormat(v as "json" | "boiada")}
              >
                <SelectTrigger className="w-32 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">.json</SelectItem>
                  <SelectItem value="boiada">.boiada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-xl border border-border p-5">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Upload className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="font-semibold">Importar</p>
                <p className="text-xs text-muted-foreground">Restaure dados de um arquivo</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg"
              >
                <Upload className="mr-1.5 h-4 w-4" /> Importar
              </Button>
              <Select
                value={importFormat}
                onValueChange={(v) => setImportFormat(v as "json" | "boiada")}
              >
                <SelectTrigger className="w-32 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">.json</SelectItem>
                  <SelectItem value="boiada">.boiada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={
                importFormat === "json" ? "application/json,.json" : ".boiada,.zip,application/zip"
              }
              className="hidden"
              onChange={openImport}
            />
          </div>
        </div>
      </Panel>

      {/* Cloud storage */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HardDrive className="h-5 w-5" />
            </span>
            <div className="max-w-md">
              <p className="font-semibold">Google Drive</p>
              <p className="text-sm text-muted-foreground">
                Armazenar comprovantes e backups em uma pasta do Google Drive.
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Requer login com conta Google (OAuth). Hoje o app funciona 100% offline.
              </p>
            </div>
          </div>
          <Button variant="outline" disabled title="Requer login de usuário" className="rounded-lg">
            <CloudUpload className="mr-1.5 h-4 w-4" /> Conectar
          </Button>
        </div>
      </Panel>

      {/* Wipe */}
      <Panel className="border-destructive/20">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div className="max-w-md">
              <p className="font-semibold text-destructive">Limpar dados</p>
              <p className="text-sm text-muted-foreground">
                Apaga registros permanentemente. Use com cautela.
              </p>
            </div>
          </div>
          <Button variant="destructive" onClick={openWipe} className="rounded-lg">
            <Trash2 className="mr-1.5 h-4 w-4" /> Limpar dados
          </Button>
        </div>
      </Panel>

      {/* Import dialog */}
      <Dialog open={!!importPayload} onOpenChange={(o) => !o && setImportPayload(null)}>
        <DialogContent className="max-h-[90vh] max-w-fit overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar dados</DialogTitle>
            <DialogDescription>Selecione as categorias que deseja restaurar.</DialogDescription>
          </DialogHeader>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <Checkbox checked={importByRecord} onCheckedChange={(v) => setImportByRecord(!!v)} />
            Escolher registros específicos
          </label>
          <div className="grid gap-2 py-2">
            {(Object.keys(IMPORT_LABELS) as ImportKey[]).map((k) => {
              const count = importPayload?.[k]?.length ?? 0;
              const items = (importPayload?.[k] ?? []) as Array<Record<string, unknown>>;
              const idsSel = importIds[k];
              return (
                <div key={k} className={"rounded-md border " + (count ? "" : "opacity-50")}>
                  <label className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={importSel[k]}
                        disabled={!count}
                        onCheckedChange={(v) => setImportSel((s) => ({ ...s, [k]: !!v }))}
                      />
                      <span className="font-medium">{IMPORT_LABELS[k]}</span>
                    </span>
                    <Badge variant="secondary">
                      {importByRecord && importSel[k] ? `${idsSel.size}/${count}` : count}
                    </Badge>
                  </label>
                  {importByRecord && importSel[k] && count > 0 && (
                    <div className="max-h-40 overflow-y-auto border-t px-3 py-2">
                      {items.map((it) => {
                        const id = String(it.id ?? "");
                        if (!id) return null;
                        const label = describeRecord(k, it);
                        return (
                          <label key={id} className="flex items-center gap-2 py-0.5 text-xs">
                            <Checkbox
                              checked={idsSel.has(id)}
                              onCheckedChange={(v) =>
                                setImportIds((s) => {
                                  const next = new Set(s[k]);
                                  if (v) next.add(id);
                                  else next.delete(id);
                                  return { ...s, [k]: next };
                                })
                              }
                            />
                            <span className="truncate">{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImportPayload(null)}>
              Cancelar
            </Button>
            <Button onClick={confirmImport}>Importar selecionados</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Wipe dialog */}
      <Dialog open={wipeOpen} onOpenChange={setWipeOpen}>
        <DialogContent className="max-h-[90vh] w-fit max-w-[90vw] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" /> Limpar dados
            </DialogTitle>
            <DialogDescription>
              Esta ação é permanente. Escolha o nível de limpeza abaixo.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={wipeMode}
            onValueChange={(v) =>
              setWipeMode(v as "geral" | "agressivo" | "escolher" | "especifico")
            }
            className="grid gap-2 py-2"
          >
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <RadioGroupItem value="geral" className="mt-1" />
              <span>
                <span className="font-medium">Limpeza geral</span>
                <span className="block text-muted-foreground">
                  Apaga viagens, combustíveis, manutenção, pedágios, recebimentos e comissões.
                  Mantém caminhões, motoristas e tabelas.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-sm">
              <RadioGroupItem value="agressivo" className="mt-1" />
              <span>
                <span className="font-medium text-destructive">Limpeza agressiva</span>
                <span className="block text-muted-foreground">
                  Apaga tudo: viagens, combustíveis, manutenção, pedágios, recebimentos, comissões,
                  caminhões, motoristas e tabelas de preços.
                </span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <RadioGroupItem value="escolher" className="mt-1" />
              <span>
                <span className="font-medium">Escolher categorias</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-md border p-3 text-sm">
              <RadioGroupItem value="especifico" className="mt-1" />
              <span>
                <span className="font-medium">Escolher registros específicos</span>
              </span>
            </label>
          </RadioGroup>
          {wipeMode === "escolher" && (
            <div className="grid gap-2 py-2">
              {(Object.keys(WIPE_LABELS) as WipeKey[]).map((k) => {
                const forced =
                  k === "payments" &&
                  (wipeSel.trips ||
                    wipeSel.tolls ||
                    wipeSel.fuelings ||
                    wipeSel.expenses ||
                    wipeSel.commissionPayments);
                return (
                  <label
                    key={k}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={wipeSel[k] || forced}
                        disabled={forced}
                        onCheckedChange={(v) => setWipeSel((s) => ({ ...s, [k]: !!v }))}
                      />
                      {WIPE_LABELS[k]}
                      {forced && (
                        <span className="text-xs text-muted-foreground">
                          (incluído automaticamente)
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          {wipeMode === "especifico" && (
            <div className="grid gap-2 py-2">
              {(Object.keys(WIPE_LABELS) as WipeKey[]).map((k) => {
                const list =
                  k === "trips"
                    ? trips
                    : k === "fuelings"
                      ? fuelings
                      : k === "expenses"
                        ? expenses
                        : k === "tolls"
                          ? tolls
                          : k === "trucks"
                            ? trucks
                            : k === "drivers"
                              ? drivers
                              : k === "priceTables"
                                ? tables
                                : k === "commissionPayments"
                                  ? commissionPayments
                                  : payments;
                const idsSel = wipeIds[k];
                if (list.length === 0) return null;
                return (
                  <div key={k} className="rounded-md border">
                    <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-xs font-medium">
                      <span>{WIPE_LABELS[k]}</span>
                      <Badge variant="secondary">
                        {idsSel.size}/{list.length}
                      </Badge>
                    </div>
                    <div className="max-h-40 overflow-y-auto px-3 py-2">
                      {(list as unknown as Array<Record<string, unknown>>).map((it) => {
                        const id = String(it.id ?? "");
                        return (
                          <label key={id} className="flex items-center gap-2 py-0.5 text-xs">
                            <Checkbox
                              checked={idsSel.has(id)}
                              onCheckedChange={(v) =>
                                setWipeIds((s) => {
                                  const next = new Set(s[k]);
                                  if (v) next.add(id);
                                  else next.delete(id);
                                  return { ...s, [k]: next };
                                })
                              }
                            />
                            <span className="truncate">{describeRecord(k, it)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <div className="mb-2 flex items-center gap-2 font-medium text-destructive">
              Confirmação
            </div>
            {wipeLoading || !wipeWord ? (
              <p className="text-muted-foreground">Carregando palavra do dia…</p>
            ) : (
              <>
                <p className="text-muted-foreground">
                  {wipeWordSource === "fallback" ? (
                    <>
                      Não foi possível conectar ao Wordle (NYT). Digite a palavra abaixo para
                      confirmar a exclusão.
                    </>
                  ) : (
                    <>
                      Digite a <strong>solução do Wordle de hoje</strong> (NYT) para confirmar.{" "}
                      <a
                        href={WORDLE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline text-primary"
                      >
                        Abrir Wordle
                      </a>
                    </>
                  )}
                </p>
                <Input
                  className="mt-2"
                  placeholder="palavra do dia"
                  value={wipeInput}
                  onChange={(e) => setWipeInput(e.target.value)}
                  autoComplete="off"
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWipeOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={!wipeWord || wipeLoading} onClick={confirmWipe}>
              Apagar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SectionShell>
  );
}

// ---------------------------------------------------------------------------
// APARÊNCIA
// ---------------------------------------------------------------------------

function AppearanceSection() {
  const [theme, setTheme] = useTheme();
  const [settings, setSettings] = useSettings();
  const paymentSoundRef = useRef<HTMLInputElement>(null);
  const receiptSoundRef = useRef<HTMLInputElement>(null);

  const handleSoundUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    key: "paymentSound" | "receiptSound",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máx 2MB)");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setSettings((s) => ({ ...s, [key]: reader.result as string }));
      toast.success("Som personalizado salvo");
    };
    reader.onerror = () => toast.error("Erro ao carregar arquivo");
    reader.readAsDataURL(file);
  };

  const removeSound = (key: "paymentSound" | "receiptSound") => {
    setSettings((s) => {
      const next = { ...s };
      delete next[key];
      return next;
    });
    toast.success("Som removido");
  };

  const playPreview = (soundDataUrl?: string) => {
    if (!soundDataUrl) return;
    try {
      new Audio(soundDataUrl).play().catch(() => {});
    } catch {
      // ignore
    }
  };

  return (
    <SectionShell
      title="Aparência"
      description="Tema, sons e preferências da aplicação."
      icon={Palette}
    >
      {/* Theme */}
      <Panel>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Palette className="h-4.5 w-4.5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Tema</p>
            <p className="text-xs text-muted-foreground">Escolha o design da aplicação.</p>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              { value: "padrao" as AppTheme, label: "Padrão", icon: Sun },
              { value: "dark" as AppTheme, label: "Dark mode", icon: Moon },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const isActive = theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all",
                  isActive
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30",
                )}
              >
                <span
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold">{opt.label}</span>
                </span>
                {isActive && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </button>
            );
          })}
        </div>
      </Panel>

      {/* Commissions */}
      <Panel>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HandCoins className="h-4.5 w-4.5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Comissões</p>
            <p className="text-xs text-muted-foreground">Valor mínimo de ajuda de custo.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <div>
            <Label className="mb-1.5">Ajuda de custo mínima (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={String(settings.ajudaCustoMax)}
              onChange={(e) =>
                setSettings((s) => ({
                  ...s,
                  ajudaCustoMax: Number(e.target.value) || 0,
                }))
              }
              className="w-40 rounded-lg"
            />
          </div>
          <p className="text-xs text-muted-foreground pb-2.5">
            O pagamento de comissão não pode ser finalizado se a ajuda de custo for menor que este
            valor.
          </p>
        </div>
      </Panel>

      {/* Editor mode */}
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock className="h-5 w-5" />
            </span>
            <div>
              <p className="font-semibold">Modo editor</p>
              <p className="text-sm text-muted-foreground">
                Mostra um botão em cada card para editar os dados em formato JSON.
              </p>
            </div>
          </div>
          <Switch
            checked={settings.editorMode ?? false}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, editorMode: !!v }))}
          />
        </div>
      </Panel>

      {/* Sounds */}
      <Panel>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Volume2 className="h-4.5 w-4.5" />
          </span>
          <div className="flex-1">
            <p className="font-semibold">Sons personalizados</p>
            <p className="text-xs text-muted-foreground">
              Tocados ao registrar pagamentos e recebimentos. Não incluídos no backup.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <p className="mb-2.5 text-sm font-semibold">Som de pagamento</p>
            {settings.paymentSound ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => playPreview(settings.paymentSound)}
                  className="rounded-lg"
                >
                  <Play className="mr-1 h-3 w-3" /> Testar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSound("paymentSound")}
                  className="rounded-lg"
                >
                  <Trash2 className="mr-1 h-3 w-3 text-destructive" /> Remover
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => paymentSoundRef.current?.click()}
                className="rounded-lg"
              >
                <Upload className="mr-1 h-3 w-3" /> Enviar arquivo
              </Button>
            )}
            <input
              ref={paymentSoundRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleSoundUpload(e, "paymentSound")}
            />
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="mb-2.5 text-sm font-semibold">Som de recebimento</p>
            {settings.receiptSound ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => playPreview(settings.receiptSound)}
                  className="rounded-lg"
                >
                  <Play className="mr-1 h-3 w-3" /> Testar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeSound("receiptSound")}
                  className="rounded-lg"
                >
                  <Trash2 className="mr-1 h-3 w-3 text-destructive" /> Remover
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => receiptSoundRef.current?.click()}
                className="rounded-lg"
              >
                <Upload className="mr-1 h-3 w-3" /> Enviar arquivo
              </Button>
            )}
            <input
              ref={receiptSoundRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => handleSoundUpload(e, "receiptSound")}
            />
          </div>
        </div>
      </Panel>
    </SectionShell>
  );
}
