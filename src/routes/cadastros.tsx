import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useMemo, type ReactNode } from "react";
import {
  useTrucks,
  useDrivers,
  useTollLocations,
  uid,
  formatBRL,
  type Truck,
  type Driver,
  type TollLocation,
  type CardinalDirection,
} from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash2,
  Truck as TruckIcon,
  User as UserIcon,
  Plus,
  Pencil,
  X,
  Coins as CoinsIcon,
  MapPin,
  Route as RouteIcon,
  Save,
  ChevronLeft,
  Settings as SettingsIcon,
  CircleDot,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cadastros")({
  head: () => ({
    meta: [
      { title: "Cadastros — Boiada" },
      { name: "description", content: "Cadastre caminhões, motoristas e pedágios." },
    ],
  }),
  component: CadastrosPage,
});

type SectionKey = "caminhoes" | "motoristas" | "pedagios";

const NAV_ITEMS: {
  key: SectionKey;
  label: string;
  icon: typeof TruckIcon;
  desc: string;
}[] = [
  { key: "caminhoes", label: "Caminhões", icon: TruckIcon, desc: "Veículos e placas" },
  { key: "motoristas", label: "Motoristas", icon: UserIcon, desc: "Motoristas ativos e inativos" },
  { key: "pedagios", label: "Pedágios", icon: CoinsIcon, desc: "Localidades de pedágio" },
];

function CadastrosPage() {
  const [section, setSection] = useState<SectionKey>("caminhoes");
  const active = NAV_ITEMS.find((n) => n.key === section)!;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
          <SettingsIcon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastros</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie caminhões, motoristas e pedágios.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
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

        <div className="min-w-0">
          <div className="mb-4 flex items-center gap-2 md:hidden">
            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">{active.desc}</span>
          </div>
          {section === "caminhoes" && <TrucksSection />}
          {section === "motoristas" && <DriversSection />}
          {section === "pedagios" && <TollLocationsSection />}
        </div>
      </div>
    </div>
  );
}

function Panel({ children, className }: { children: ReactNode; className?: string }) {
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
// CAMINHÕES
// ---------------------------------------------------------------------------

function TrucksSection() {
  const [trucks, setTrucks] = useTrucks();
  const [name, setName] = useState("");
  const [plate, setPlate] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => {
    setEditingId(null);
    setName("");
    setPlate("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !plate.trim()) return;
    if (editingId) {
      setTrucks((prev) =>
        prev.map((t) =>
          t.id === editingId ? { ...t, name: name.trim(), plate: plate.trim().toUpperCase() } : t,
        ),
      );
      toast.success("Caminhão atualizado");
    } else {
      const t: Truck = { id: uid(), name: name.trim(), plate: plate.trim().toUpperCase() };
      setTrucks((prev) => [...prev, t]);
      toast.success("Caminhão cadastrado");
    }
    reset();
  };

  const startEdit = (t: Truck) => {
    setEditingId(t.id);
    setName(t.name);
    setPlate(t.plate);
  };
  const remove = (id: string) => {
    setTrucks((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) reset();
    toast.success("Caminhão removido");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <TruckIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Caminhões</h2>
          <p className="text-sm text-muted-foreground">Veículos e placas.</p>
        </div>
      </div>

      <Panel>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <div>
            <Label htmlFor="tname">Nome / Apelido</Label>
            <Input
              id="tname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Volvo Branco"
            />
          </div>
          <div>
            <Label htmlFor="tplate">Placa</Label>
            <Input
              id="tplate"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              placeholder="ABC-1D23"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">
              <Plus className="mr-1 h-4 w-4" /> {editingId ? "Salvar" : "Adicionar"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={reset}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </Panel>

      {trucks.length === 0 ? (
        <Panel className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <TruckIcon className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Nenhum caminhão cadastrado.</p>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {trucks.map((t) => (
            <Panel key={t.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                    <TruckIcon className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.plate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MOTORISTAS
// ---------------------------------------------------------------------------

function DriversSection() {
  const [drivers, setDrivers] = useDrivers();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [active, setActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setActive(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (editingId) {
      setDrivers((prev) =>
        prev.map((d) =>
          d.id === editingId
            ? { ...d, name: name.trim(), phone: phone.trim(), active }
            : d,
        ),
      );
      toast.success("Motorista atualizado");
    } else {
      const d: Driver = { id: uid(), name: name.trim(), phone: phone.trim(), active };
      setDrivers((prev) => [...prev, d]);
      toast.success("Motorista cadastrado");
    }
    reset();
  };

  const startEdit = (d: Driver) => {
    setEditingId(d.id);
    setName(d.name);
    setPhone(d.phone ?? "");
    setActive(d.active);
  };
  const toggleActive = (id: string) =>
    setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, active: !d.active } : d)));
  const remove = (id: string) => {
    setDrivers((prev) => prev.filter((d) => d.id !== id));
    if (editingId === id) reset();
    toast.success("Motorista removido");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <UserIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Motoristas</h2>
          <p className="text-sm text-muted-foreground">Ativos e inativos.</p>
        </div>
      </div>

      <Panel>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto_auto]">
          <div>
            <Label htmlFor="dname">Nome</Label>
            <Input
              id="dname"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="João da Silva"
            />
          </div>
          <div>
            <Label htmlFor="dphone">Telefone</Label>
            <Input
              id="dphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="flex flex-col justify-end gap-1">
            <Label className="text-xs">Ativo</Label>
            <div className="flex h-10 items-center">
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">
              <Plus className="mr-1 h-4 w-4" /> {editingId ? "Salvar" : "Adicionar"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={reset}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </Panel>

      {drivers.length === 0 ? (
        <Panel className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <UserIcon className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Nenhum motorista cadastrado.</p>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {drivers.map((d) => (
            <Panel key={d.id}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-secondary">
                    <UserIcon className="h-5 w-5 text-secondary-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{d.name}</p>
                      <Badge variant={d.active ? "default" : "secondary"}>
                        {d.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {d.phone && <p className="text-xs text-muted-foreground">{d.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={d.active} onCheckedChange={() => toggleActive(d.id)} />
                  <Button variant="ghost" size="icon" onClick={() => startEdit(d)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(d.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PEDÁGIOS (Localidades)
// ---------------------------------------------------------------------------

const DIRECTION_OPTIONS: CardinalDirection[] = ["N", "S", "L", "O", "N/S", "L/O"];

function TollLocationsSection() {
  const [locations, setLocations] = useTollLocations();
  const [name, setName] = useState("");
  const [highway, setHighway] = useState("");
  const [km, setKm] = useState("");
  const [city, setCity] = useState("");
  const [direction, setDirection] = useState<CardinalDirection>("N/S");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const reset = () => {
    setEditingId(null);
    setName("");
    setHighway("");
    setKm("");
    setCity("");
    setDirection("N/S");
    setLatitude("");
    setLongitude("");
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Informe o nome do pedágio.");
      return;
    }
    const lat = latitude ? Number(latitude) : undefined;
    const lng = longitude ? Number(longitude) : undefined;
    if (editingId) {
      setLocations((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                name: name.trim(),
                highway: highway.trim(),
                km: km.trim(),
                city: city.trim(),
                direction,
                latitude: lat,
                longitude: lng,
              }
            : t,
        ),
      );
      toast.success("Pedágio atualizado");
    } else {
      const t: TollLocation = {
        id: uid(),
        name: name.trim(),
        highway: highway.trim(),
        km: km.trim(),
        city: city.trim(),
        direction,
        latitude: lat,
        longitude: lng,
      };
      setLocations((prev) => [...prev, t]);
      toast.success("Pedágio cadastrado");
    }
    reset();
  };

  const startEdit = (t: TollLocation) => {
    setEditingId(t.id);
    setName(t.name);
    setHighway(t.highway);
    setKm(t.km);
    setCity(t.city);
    setDirection(t.direction);
    setLatitude(t.latitude != null ? String(t.latitude) : "");
    setLongitude(t.longitude != null ? String(t.longitude) : "");
  };
  const remove = (id: string) => {
    setLocations((prev) => prev.filter((t) => t.id !== id));
    if (editingId === id) reset();
    toast.success("Pedágio removido");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CoinsIcon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight">Pedágios</h2>
          <p className="text-sm text-muted-foreground">
            Cadastre as localidades de pedágio para usar nos lançamentos.
          </p>
        </div>
      </div>

      <Panel>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pName">Nome do pedágio</Label>
              <Input
                id="pName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Praça Anhanguera"
              />
            </div>
            <div>
              <Label htmlFor="pHighway">Rodovia</Label>
              <Input
                id="pHighway"
                value={highway}
                onChange={(e) => setHighway(e.target.value)}
                placeholder="BR-060"
              />
            </div>
            <div>
              <Label htmlFor="pKm">KM</Label>
              <Input
                id="pKm"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="km 120"
              />
            </div>
            <div>
              <Label htmlFor="pCity">Cidade</Label>
              <Input
                id="pCity"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Anápolis/GO"
              />
            </div>
            <div>
              <Label htmlFor="pDir">Direção</Label>
              <Select
                value={direction}
                onValueChange={(v) => setDirection(v as CardinalDirection)}
              >
                <SelectTrigger id="pDir">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTION_OPTIONS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="pLat">Latitude (opcional)</Label>
              <Input
                id="pLat"
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                placeholder="-16.3286"
              />
            </div>
            <div>
              <Label htmlFor="pLng">Longitude (opcional)</Label>
              <Input
                id="pLng"
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                placeholder="-48.9528"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit">
              <Plus className="mr-1 h-4 w-4" /> {editingId ? "Salvar" : "Adicionar"}
            </Button>
            {editingId && (
              <Button type="button" variant="ghost" onClick={reset}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>
      </Panel>

      {locations.length === 0 ? (
        <Panel className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
            <CoinsIcon className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">Nenhum pedágio cadastrado.</p>
        </Panel>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {locations.map((t) => (
            <Panel key={t.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5">
                  <p className="font-semibold">{t.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {t.highway && <Badge variant="secondary">{t.highway}</Badge>}
                    {t.km && <Badge variant="outline">KM {t.km}</Badge>}
                    <Badge variant="outline">{t.direction}</Badge>
                  </div>
                  {t.city && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {t.city}
                    </p>
                  )}
                  {t.latitude != null && t.longitude != null && (
                    <p className="text-xs text-muted-foreground">
                      {t.latitude.toFixed(4)}, {t.longitude.toFixed(4)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => startEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
