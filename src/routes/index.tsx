import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useActiveTrips,
  useTrucks,
  usePriceTiers,
  useFuelings,
  useExpenses,
  useTolls,
  usePayments,
  formatBRL,
  formatDateBR,
  RENT_PERCENT,
} from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Route as RouteIcon,
  DollarSign,
  Plus,
  Fuel,
  Wrench,
  Coins,
  Banknote,
  TrendingUp,
  TrendingDown,
  Wallet,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Boiada — Controle de viagens de gado" },
      { name: "description", content: "Registre viagens de transporte de gado e calcule o valor automaticamente." },
      { property: "og:title", content: "Boiada — Controle de viagens de gado" },
      { property: "og:description", content: "Registre viagens de transporte de gado e calcule o valor automaticamente." },
    ],
  }),
  component: Index,
});

function fuelingTotal(items: { quantity: number; unitPrice: number }[]) {
  return items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
}

function Index() {
  const [allTrips] = useActiveTrips();
  const [trucks] = useTrucks();
  const [tiers] = usePriceTiers();
  const [allFuelings] = useFuelings();
  const [allExpenses] = useExpenses();
  const [allTolls] = useTolls();
  const [allPayments] = usePayments();

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const inRange = (d: string) => {
    const ymd = d.slice(0, 10);
    if (dateFrom && ymd < dateFrom) return false;
    if (dateTo && ymd > dateTo) return false;
    return true;
  };
  const trips = useMemo(() => allTrips.filter((t) => inRange(t.date)), [allTrips, dateFrom, dateTo]);
  const fuelings = useMemo(() => allFuelings.filter((f) => inRange(f.date)), [allFuelings, dateFrom, dateTo]);
  const expenses = useMemo(() => allExpenses.filter((e) => inRange(e.date)), [allExpenses, dateFrom, dateTo]);
  const tolls = useMemo(() => allTolls.filter((t) => inRange(t.dateTime)), [allTolls, dateFrom, dateTo]);
  const payments = useMemo(() => allPayments.filter((p) => inRange(p.date)), [allPayments, dateFrom, dateTo]);

  const lockedTrips = useMemo(() => new Set(payments.flatMap((p) => p.tripIds)), [payments]);
  const lockedFuel = useMemo(() => new Set(payments.flatMap((p) => p.fuelingIds)), [payments]);
  const lockedExp = useMemo(() => new Set(payments.flatMap((p) => p.expenseIds)), [payments]);
  const lockedTolls = useMemo(() => new Set(payments.flatMap((p) => p.tollIds)), [payments]);

  const totalRevenue = trips.reduce((sum, t) => sum + t.finalValue, 0);
  const totalKm = trips.reduce(
    (sum, t) => sum + Math.max(0, t.kmEnd - t.kmStart || (t.manualDistance ?? 0)),
    0,
  );
  const fuelTotal = fuelings.reduce((s, f) => s + fuelingTotal(f.items), 0);
  const maintTotal = expenses.reduce((s, e) => s + e.value, 0);
  const tollTotal = tolls.reduce((s, t) => s + t.value, 0);
  const totalReceived = payments.reduce((s, p) => s + p.receivedValue, 0);

  // Em aberto
  const openTripsTotal = trips
    .filter((t) => !lockedTrips.has(t.id))
    .reduce((s, t) => s + t.finalValue, 0);
  const openFuelTotal = fuelings
    .filter((f) => !lockedFuel.has(f.id) && f.deductFromPayment)
    .reduce((s, f) => s + fuelingTotal(f.items), 0);
  const openExpDesc = expenses
    .filter((e) => !lockedExp.has(e.id) && e.responsibility === "desconto")
    .reduce((s, e) => s + e.value, 0);
  const openExpRess = expenses
    .filter((e) => !lockedExp.has(e.id) && e.responsibility === "ressarcir")
    .reduce((s, e) => s + e.value, 0);
  const openTollDesc = tolls
    .filter((t) => !lockedTolls.has(t.id) && t.responsibility === "desconto")
    .reduce((s, t) => s + t.value, 0);
  const openTollRess = tolls
    .filter((t) => !lockedTolls.has(t.id) && t.responsibility === "ressarcir")
    .reduce((s, t) => s + t.value, 0);
  const openRent = openTripsTotal * RENT_PERCENT;
  const openExpected =
    openTripsTotal + openExpRess + openTollRess - openRent - openFuelTotal - openExpDesc - openTollDesc;

  const stats = [
    { label: "Viagens", value: trips.length.toString(), icon: RouteIcon, hint: `${totalKm.toLocaleString("pt-BR")} km` },
    { label: "Receita das viagens", value: formatBRL(totalRevenue), icon: DollarSign },
    { label: "Combustíveis", value: formatBRL(fuelTotal), icon: Fuel },
    { label: "Manutenção + Pedágios", value: formatBRL(maintTotal + tollTotal), icon: Wrench },
    { label: "Total recebido", value: formatBRL(totalReceived), icon: Banknote },
    { label: "Recebimentos", value: payments.length.toString(), icon: Wallet },
  ];

  const recent = [...trips].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const recentPayments = [...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const needsSetup = trucks.length === 0 || tiers.length === 0;

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant">
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-widest opacity-80">Painel</p>
          <h2 className="mt-2 text-4xl font-bold">Boiada</h2>
          <p className="mt-3 text-base opacity-90">
            Viagens, despesas e recebimentos do transporte de gado em um único lugar.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-xs uppercase opacity-80">Em aberto (líquido esperado)</p>
              <p className="text-2xl font-bold">{formatBRL(openExpected)}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-xs uppercase opacity-80">Viagens em aberto</p>
              <p className="text-2xl font-bold">{formatBRL(openTripsTotal)}</p>
            </div>
            <div className="rounded-lg bg-white/10 p-3">
              <p className="text-xs uppercase opacity-80">Descontos em aberto</p>
              <p className="text-2xl font-bold">{formatBRL(openFuelTotal + openExpDesc + openTollDesc)}</p>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="secondary">
              <Link to="/viagens"><Plus className="mr-1 h-4 w-4" /> Nova viagem</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link to="/recebimentos"><Banknote className="mr-1 h-4 w-4" /> Novo recebimento</Link>
            </Button>
            {needsSetup && (
              <Button asChild size="lg" variant="outline" className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10">
                <Link to="/configuracoes">Configurar tabela</Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-44" />
          </div>
          {(dateFrom || dateTo) && (
            <Button variant="ghost" size="sm" onClick={() => { setDateFrom(""); setDateTo(""); }}>
              <X className="mr-1 h-3 w-3" /> Limpar
            </Button>
          )}
          <p className="ml-auto text-xs text-muted-foreground">
            {dateFrom || dateTo ? "Painel filtrado pelo período" : "Mostrando todos os períodos"}
          </p>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label} className="p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{s.label}</p>
              <s.icon className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-2 text-2xl font-bold text-foreground">{s.value}</p>
            {s.hint && <p className="text-xs text-muted-foreground">{s.hint}</p>}
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Coins className="h-4 w-4 text-accent" /> Despesas registradas
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-muted-foreground">Combustíveis</span><span className="font-semibold">{formatBRL(fuelTotal)}</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">Manutenção</span><span className="font-semibold">{formatBRL(maintTotal)}</span></li>
            <li className="flex justify-between"><span className="text-muted-foreground">Pedágios</span><span className="font-semibold">{formatBRL(tollTotal)}</span></li>
          </ul>
        </Card>
        <Card className="p-5 shadow-soft">
          <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
            <Wallet className="h-4 w-4 text-accent" /> Em aberto (próximo recebimento)
          </h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span className="text-muted-foreground">Bruto (viagens)</span><span className="font-semibold">{formatBRL(openTripsTotal)}</span></li>
            <li className="flex justify-between text-emerald-600"><span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Ressarcimentos</span><span className="font-semibold">+ {formatBRL(openExpRess + openTollRess)}</span></li>
            <li className="flex justify-between text-destructive"><span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Aluguel ({(RENT_PERCENT * 100).toFixed(0)}%)</span><span className="font-semibold">- {formatBRL(openRent)}</span></li>
            <li className="flex justify-between text-destructive"><span className="flex items-center gap-1"><TrendingDown className="h-3 w-3" /> Descontos</span><span className="font-semibold">- {formatBRL(openFuelTotal + openExpDesc + openTollDesc)}</span></li>
            <li className="mt-2 flex justify-between border-t border-border pt-2 text-base"><span className="font-bold">Esperado</span><span className="font-bold text-primary">{formatBRL(openExpected)}</span></li>
          </ul>
        </Card>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-bold">Viagens recentes</h3>
          <Button asChild variant="ghost" size="sm">
            <Link to="/viagens">Ver todas →</Link>
          </Button>
        </div>
        {recent.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">
            Nenhuma viagem registrada ainda. Comece registrando a primeira.
          </Card>
        ) : (
          <div className="space-y-2">
            {recent.map((t) => {
              const truck = trucks.find((x) => x.id === t.truckId);
              const km = t.kmEnd > t.kmStart ? t.kmEnd - t.kmStart : (t.manualDistance ?? 0);
              return (
                <Card key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-soft">
                  <div>
                    <p className="font-semibold text-foreground">
                      {t.origin} → {t.destination}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateBR(t.date)} • {truck?.name ?? "—"} • Gado {t.cattleType}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{formatBRL(t.finalValue)}</p>
                    <p className="text-xs text-muted-foreground">
                      {km.toLocaleString("pt-BR")} km
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {recentPayments.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-bold">Recebimentos recentes</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/recebimentos">Ver todos →</Link>
            </Button>
          </div>
          <div className="space-y-2">
            {recentPayments.map((p) => (
              <Card key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 shadow-soft">
                <div>
                  <p className="font-semibold">{formatDateBR(p.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.tripIds.length} viagem(ns) • Bruto {formatBRL(p.grossValue)}
                  </p>
                </div>
                <p className="text-lg font-bold text-primary">{formatBRL(p.receivedValue)}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
