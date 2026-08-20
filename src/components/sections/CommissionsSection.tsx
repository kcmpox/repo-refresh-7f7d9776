import { useMemo, useState } from "react";
import {
  useActiveTrips,
  useDrivers,
  useDriverEntries,
  useCommissionPayments,
  usePriceTables,
  useSettings,
  uid,
  formatBRL,
  formatDateBR,
  computeCommissionForTrips,
  recalculateDriverPayments,
  calculateTripValue,
  capAjudaCusto,
  type Trip,
  type CommissionPayment,
  type DriverEntry,
  type DriverEntryType,
} from "@/lib/storage";
import { Card } from "@/components/ui/card";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { X, User as UserIcon, Plus, Trash2, FileDown, Wallet, Gift, HandCoins, CircleCheck as CheckCircle2, Clock, TrendingDown, TrendingUp, CircleAlert as AlertCircle, RefreshCw, Code as Code2 } from "lucide-react";
import { toast } from "sonner";
import {
  buildPdfDoc,
  previewPdf,
  pdfKpiRow,
  pdfSectionTitle,
  pdfTableLayout,
  th,
} from "@/lib/pdf-theme";
import { JsonEditorDialog } from "@/components/JsonEditorDialog";

function playSoundIfSet(soundDataUrl?: string) {
  if (!soundDataUrl) return;
  try {
    const audio = new Audio(soundDataUrl);
    audio.play().catch(() => {});
  } catch {
    // ignore
  }
}

const ENTRY_TYPE_LABEL: Record<DriverEntryType, string> = {
  comissao: "Comissão manual",
  vale: "Vale",
  ajuda_custo: "Ajuda de custo",
  pagamento: "Pagamento",
  desconto: "Desconto",
  bonus: "Bônus",
};

/** IDs of driver entries already consumed by finalized payments.
 *  Falls back to date-range filtering for legacy payments without entryIds. */
function consumedEntryIds(
  payments: CommissionPayment[],
  driverId: string,
  entries: DriverEntry[],
): Set<string> {
  const ids = new Set<string>();
  const driverPayments = payments
    .filter((p) => p.driverId === driverId && p.finalized)
    .sort((a, b) => a.date.localeCompare(b.date));
  for (const p of driverPayments) {
    if (p.entryIds && p.entryIds.length > 0) {
      for (const id of p.entryIds) ids.add(id);
    } else {
      const periodStart = p.periodStart;
      const periodEnd = p.periodEnd || p.date;
      for (const e of entries) {
        if (e.driverId === driverId && e.date > periodStart && e.date <= periodEnd) {
          ids.add(e.id);
        }
      }
    }
  }
  return ids;
}

interface DriverPeriodCard {
  driverId: string;
  driverName: string;
  active: boolean;
  periodStart: string;
  trips: Trip[];
  tripIds: string[];
  commission: number;
  manualCommissions: DriverEntry[];
  manualCommissionsTotal: number;
  lostAnimals: number;
  lostValue: number;
  valesSinceLastPayment: DriverEntry[];
  valesTotal: number;
  ajudaCustoSinceLastPayment: DriverEntry[];
  ajudaCustoTotal: number;
  descontosSinceLastPayment: DriverEntry[];
  descontosTotal: number;
  bonusSinceLastPayment: DriverEntry[];
  bonusTotal: number;
  allEntriesSinceLastPayment: DriverEntry[];
  previousCarriedVales: number;
  previousShortfall: number;
  balance: number;
  openPayment?: CommissionPayment;
  pastPayments: CommissionPayment[];
}

export function CommissionsSection() {
  const [trips, setTrips] = useActiveTrips();
  const [drivers] = useDrivers();
  const [entries] = useDriverEntries();
  const [tables] = usePriceTables();
  const [commissionPayments, setCommissionPayments] = useCommissionPayments();
  const [settings] = useSettings();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [payDialogDriverId, setPayDialogDriverId] = useState<string | null>(null);
  const [entryDialogDriverId, setEntryDialogDriverId] = useState<string | null>(null);
  const [jsonEditPayment, setJsonEditPayment] = useState<CommissionPayment | null>(null);
  const [jsonEditOpen, setJsonEditOpen] = useState(false);

  const ajudaCustoMax = settings.ajudaCustoMax;

  const cards = useMemo<DriverPeriodCard[]>(() => {
    return drivers.map((driver) => {
      const driverPayments = commissionPayments
        .filter((p) => p.driverId === driver.id)
        .sort((a, b) => a.date.localeCompare(b.date));

      const finalizedPayments = driverPayments.filter((p) => p.finalized);
      const lastPayment = finalizedPayments[finalizedPayments.length - 1];
      const lastPeriodEnd = lastPayment?.periodEnd ?? lastPayment?.date ?? "";

      const periodTrips = trips
        .filter((t) => t.driverId === driver.id && t.date > lastPeriodEnd)
        .sort((a, b) => a.date.localeCompare(b.date));

      const consumed = consumedEntryIds(commissionPayments, driver.id, entries);
      const periodEntries = entries.filter((e) => e.driverId === driver.id && !consumed.has(e.id));
      const valesSinceLastPayment = periodEntries.filter((e) => e.type === "vale");
      const ajudaCustoSinceLastPayment = periodEntries.filter((e) => e.type === "ajuda_custo");
      const descontosSinceLastPayment = periodEntries.filter((e) => e.type === "desconto");
      const bonusSinceLastPayment = periodEntries.filter((e) => e.type === "bonus");
      const manualCommissions = periodEntries.filter((e) => e.type === "comissao");
      const valesTotal = valesSinceLastPayment.reduce((s, e) => s + e.amount, 0);
      const ajudaCustoTotal = ajudaCustoSinceLastPayment.reduce((s, e) => s + e.amount, 0);
      const descontosTotal = descontosSinceLastPayment.reduce((s, e) => s + e.amount, 0);
      const bonusTotal = bonusSinceLastPayment.reduce((s, e) => s + e.amount, 0);
      const manualCommissionsTotal = manualCommissions.reduce((s, e) => s + e.amount, 0);

      const lostAnimals = periodTrips.reduce((s, t) => s + t.lostAnimals, 0);
      const lostValue = periodTrips.reduce((s, t) => s + t.lostAnimals * t.lostAnimalValue, 0);
      const commission = computeCommissionForTrips(periodTrips);

      const previousCarriedVales = lastPayment
        ? (lastPayment.remainingVales ?? 0) + (lastPayment.excessAsVale ?? 0)
        : 0;
      const previousShortfall = lastPayment?.shortfall ?? 0;

      const totalCommission = commission + manualCommissionsTotal;
      const totalVales = valesTotal + previousCarriedVales;
      const balance =
        totalCommission + bonusTotal - totalVales - descontosTotal + previousShortfall;

      const openPayment = driverPayments.find((p) => !p.finalized);

      return {
        driverId: driver.id,
        driverName: driver.name,
        active: driver.active,
        periodStart: lastPeriodEnd,
        trips: periodTrips,
        tripIds: periodTrips.map((t) => t.id),
        commission,
        manualCommissions,
        manualCommissionsTotal,
        lostAnimals,
        lostValue,
        valesSinceLastPayment,
        valesTotal,
        ajudaCustoSinceLastPayment,
        ajudaCustoTotal,
        descontosSinceLastPayment,
        descontosTotal,
        bonusSinceLastPayment,
        bonusTotal,
        allEntriesSinceLastPayment: periodEntries,
        previousCarriedVales,
        previousShortfall,
        balance,
        openPayment,
        pastPayments: finalizedPayments,
      };
    });
  }, [trips, drivers, entries, commissionPayments]);

  const filteredCards = useMemo(() => {
    if (!dateFrom && !dateTo) {
      return cards.filter((c) => c.openPayment || c.trips.length > 0 || c.pastPayments.length > 0);
    }
    return cards.filter((c) => {
      const paymentDates = c.pastPayments.map((p) => p.date);
      if (c.openPayment) paymentDates.push(c.openPayment.date);
      return paymentDates.some((d) => {
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
    });
  }, [cards, dateFrom, dateTo]);

  const removePayment = (id: string) => {
    if (!window.confirm("Remover este pagamento de comissão?")) return;
    const removed = commissionPayments.find((p) => p.id === id);
    setCommissionPayments((prev) => prev.filter((p) => p.id !== id));
    if (removed) {
      // Recalculate remaining payments for this driver to re-cap ajuda de custo
      setTimeout(() => {
        setCommissionPayments((prev) =>
          recalculateDriverPayments(
            removed.driverId,
            prev.filter((p) => p.id !== id),
            trips,
            entries,
            settings.ajudaCustoMax,
          ),
        );
      }, 0);
    }
    toast.success("Pagamento removido");
  };

  const handleRecalculate = (driverId: string) => {
    if (
      !window.confirm(
        "Recalcular? Os valores das viagens serão atualizados pela tabela ATUAL e os pagamentos recomputados.",
      )
    )
      return;
    // 1) Re-save all trips for this driver (update tableValue/finalValue like edit+save)
    setTrips((prev) =>
      prev.map((t) => {
        if (t.driverId !== driverId) return t;
        const km =
          t.kmStart > 0 || t.kmEnd > 0 ? Math.max(0, t.kmEnd - t.kmStart) : (t.manualDistance ?? 0);
        const table = tables.find((tb) => tb.id === t.priceTableId);
        const tableValue = calculateTripValue(
          table,
          t.cattleType,
          km,
          t.cattleType === "magro" ? t.manualValue : undefined,
        );
        const lossTotal = t.lostAnimals * t.lostAnimalValue;
        return { ...t, tableValue, finalValue: Math.max(0, tableValue - lossTotal) };
      }),
    );
    // 2) Recalculate commission payments with updated trips
    setCommissionPayments((prev) =>
      recalculateDriverPayments(driverId, prev, trips, entries, settings.ajudaCustoMax),
    );
    toast.success("Viagens e pagamentos recalculados");
  };

  const generatePaymentPDF = async (card: DriverPeriodCard, payment: CommissionPayment) => {
    try {
      const dTrips = card.trips
        .filter((t) => payment.tripIds.includes(t.id))
        .sort((a, b) => a.date.localeCompare(b.date));

      const grossEarnings =
        payment.commissionValue +
        (payment.manualCommissionsTotal ?? 0) +
        (payment.bonusTotal ?? 0) -
        (payment.descontosTotal ?? 0) +
        (payment.previousShortfall ?? 0);

      const content: unknown[] = [
        pdfKpiRow([
          { label: "Total a receber", value: formatBRL(grossEarnings) },
          { label: "Vales descontados", value: formatBRL(payment.valeDeducted ?? 0) },
          { label: "Saldo a pagar", value: formatBRL(payment.balanceDue) },
          { label: "Valor pago", value: formatBRL(payment.paidAmount) },
        ]),
      ];

      if (dTrips.length > 0) {
        content.push(pdfSectionTitle("Viagens do periodo"));
        content.push({
          table: {
            headerRows: 1,
            widths: ["auto", "*", "*", "auto", "auto", "auto"],
            body: [
              [th("Data"), th("Origem"), th("Destino"), th("Km"), th("Perdas"), th("Valor")],
              ...dTrips.map((t) => {
                const km =
                  t.kmStart > 0 || t.kmEnd > 0
                    ? Math.max(0, t.kmEnd - t.kmStart)
                    : (t.manualDistance ?? 0);
                return [
                  formatDateBR(t.date),
                  t.origin,
                  t.destination ?? "—",
                  String(km),
                  t.lostAnimals > 0
                    ? `${t.lostAnimals} (${formatBRL(t.lostAnimals * t.lostAnimalValue)})`
                    : "-",
                  formatBRL(t.finalValue),
                ];
              }),
            ],
          },
          layout: pdfTableLayout,
          fontSize: 9,
        });
      }

      // --- Ganhos ---
      content.push(pdfSectionTitle("Ganhos"));
      content.push({
        table: {
          widths: ["*", "auto"],
          body: [
            ["Comissão das viagens (10% - perdas)", formatBRL(payment.commissionValue)],
            ...(payment.manualCommissionsTotal > 0
              ? [["Comissões manuais", formatBRL(payment.manualCommissionsTotal)]]
              : []),
            ...(payment.bonusTotal > 0 ? [["Bônus", formatBRL(payment.bonusTotal)]] : []),
            ...(payment.descontosTotal > 0
              ? [["Descontos", `- ${formatBRL(payment.descontosTotal)}`]]
              : []),
            ...(payment.previousShortfall > 0
              ? [["Saldo a receber do período anterior", formatBRL(payment.previousShortfall)]]
              : []),
            ["Total a receber (antes de vales)", formatBRL(grossEarnings)],
          ],
        },
        layout: pdfTableLayout,
        fontSize: 10,
      });

      // --- Vales ---
      content.push(pdfSectionTitle("Vales"));
      content.push({
        table: {
          widths: ["*", "auto"],
          body: [
            ...(payment.previousCarriedVales > 0
              ? [["Vales do período anterior", formatBRL(payment.previousCarriedVales)]]
              : []),
            [
              "Vales acumulados no período",
              formatBRL(payment.valesTotal - (payment.previousCarriedVales ?? 0)),
            ],
            ["Vales descontados neste pagamento", `- ${formatBRL(payment.valeDeducted ?? 0)}`],
            ["Vales restantes (para o próximo pagamento)", formatBRL(payment.remainingVales)],
          ],
        },
        layout: pdfTableLayout,
        fontSize: 10,
      });

      // --- Pagamento ---
      content.push(pdfSectionTitle("Pagamento"));
      content.push({
        table: {
          widths: ["*", "auto"],
          body: [
            ["Saldo a pagar (total a receber - vales descontados)", formatBRL(payment.balanceDue)],
            ["Valor pago", formatBRL(payment.paidAmount)],
            ...(payment.excessAsVale > 0
              ? [["Excesso (vira vale no próximo pagamento)", formatBRL(payment.excessAsVale)]]
              : []),
            ...(payment.shortfall > 0
              ? [["Falta (abatida no próximo pagamento)", formatBRL(payment.shortfall)]]
              : []),
          ],
        },
        layout: pdfTableLayout,
        fontSize: 10,
      });

      // --- Ajuda de custo ---
      content.push(pdfSectionTitle("Ajuda de custo"));
      content.push({
        table: {
          widths: ["*", "auto"],
          body: [["Ajuda de custo acumulada no período", formatBRL(payment.ajudaCusto)]],
        },
        layout: pdfTableLayout,
        fontSize: 10,
      });

      await previewPdf(
        buildPdfDoc({
          title: `Comissao — ${card.driverName}`,
          subtitle: `Pagamento: ${formatDateBR(payment.date)}`,
          content,
        }),
        `comissao-${card.driverName}-${payment.date}.pdf`,
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Comissões</h2>
        <p className="text-muted-foreground">
          Pagamentos de comissão por período. O saldo é 10% das viagens realizadas desde o último
          pagamento, menos perdas e vales.
        </p>
      </div>

      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De (data de pagamento)</Label>
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
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
            >
              <X className="mr-1 h-3 w-3" /> Limpar
            </Button>
          )}
          <p className="ml-auto text-xs text-muted-foreground">
            {!dateFrom && !dateTo
              ? "Exibindo pagamentos em aberto"
              : `${filteredCards.length} motorista(s)`}
          </p>
        </div>
      </Card>

      {filteredCards.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum motorista com movimentação no período.
        </Card>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filteredCards.map((c) => (
            <CommissionCard
              key={c.driverId}
              card={c}
              ajudaCustoMax={ajudaCustoMax}
              editorMode={settings.editorMode ?? false}
              onPay={() => setPayDialogDriverId(c.driverId)}
              onRemovePayment={removePayment}
              onPDF={generatePaymentPDF}
              onAddEntry={() => setEntryDialogDriverId(c.driverId)}
              onRecalculate={handleRecalculate}
              onEditPayment={(p) => {
                setJsonEditPayment(p);
                setJsonEditOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {payDialogDriverId && (
        <PayCommissionDialog
          driverId={payDialogDriverId}
          card={cards.find((c) => c.driverId === payDialogDriverId)!}
          ajudaCustoMax={ajudaCustoMax}
          onClose={() => setPayDialogDriverId(null)}
          onSaved={() => {
            setPayDialogDriverId(null);
            playSoundIfSet(settings.paymentSound);
          }}
        />
      )}

      {entryDialogDriverId && (
        <AddEntryDialog
          driverId={entryDialogDriverId}
          card={cards.find((c) => c.driverId === entryDialogDriverId)!}
          ajudaCustoMax={ajudaCustoMax}
          onClose={() => setEntryDialogDriverId(null)}
        />
      )}

      <JsonEditorDialog
        open={jsonEditOpen}
        onOpenChange={setJsonEditOpen}
        title={`Editar pagamento de comissão — ${jsonEditPayment?.date ?? ""}`}
        data={jsonEditPayment}
        onSave={(updated) => {
          if (jsonEditPayment && updated && typeof updated === "object") {
            setCommissionPayments((prev) =>
              prev.map((p) =>
                p.id === jsonEditPayment.id ? ({ ...p, ...updated } as CommissionPayment) : p,
              ),
            );
          }
        }}
      />
    </div>
  );
}

function getDisableReasons(card: DriverPeriodCard, ajudaCustoMax: number): string[] {
  const reasons: string[] = [];
  if (card.trips.length === 0 && card.manualCommissionsTotal === 0) {
    reasons.push("Não há viagens nem comissões manuais no período.");
  }
  if (card.ajudaCustoTotal < ajudaCustoMax) {
    reasons.push(
      `Ajuda de custo (${formatBRL(card.ajudaCustoTotal)}) é menor que o mínimo de ${formatBRL(ajudaCustoMax)}.`,
    );
  }
  if (card.balance <= 0) {
    reasons.push(`O saldo está negativo ou zerado (${formatBRL(card.balance)}).`);
  }
  return reasons;
}

function CommissionCard({
  card,
  ajudaCustoMax,
  editorMode,
  onPay,
  onRemovePayment,
  onPDF,
  onAddEntry,
  onRecalculate,
  onEditPayment,
}: {
  card: DriverPeriodCard;
  ajudaCustoMax: number;
  editorMode: boolean;
  onPay: () => void;
  onRemovePayment: (id: string) => void;
  onPDF: (card: DriverPeriodCard, payment: CommissionPayment) => void;
  onAddEntry: () => void;
  onRecalculate: (driverId: string) => void;
  onEditPayment: (payment: CommissionPayment) => void;
}) {
  const [, setEntries] = useDriverEntries();
  const ajudaCustoOk = card.ajudaCustoTotal >= ajudaCustoMax;
  const disableReasons = getDisableReasons(card, ajudaCustoMax);
  const canPay = disableReasons.length === 0;
  const [jsonEditEntry, setJsonEditEntry] = useState<DriverEntry | null>(null);
  const [jsonEditEntryOpen, setJsonEditEntryOpen] = useState(false);

  const removeEntry = (id: string) => {
    if (!window.confirm("Remover este lançamento?")) return;
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast.success("Lançamento removido");
  };

  return (
    <Card className="p-5 shadow-soft">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserIcon className="h-5 w-5 text-accent" />
          <p className="text-lg font-bold">
            {card.driverName} {!card.active && <span title="Inativo">⚰️</span>}
          </p>
        </div>
        <Badge variant={card.balance >= 0 ? "default" : "destructive"} className="text-sm">
          Saldo: {formatBRL(card.balance)}
        </Badge>
      </div>

      {card.periodStart && (
        <p className="mb-2 text-xs text-muted-foreground">
          Período: {formatDateBR(card.periodStart)} até hoje
          {card.pastPayments.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-2 h-5 px-1 text-xs"
              onClick={() => onRecalculate(card.driverId)}
              title="Recalcular pagamentos passados"
            >
              <RefreshCw className="mr-1 h-3 w-3" /> Recalcular
            </Button>
          )}
        </p>
      )}

      <ul className="space-y-1 text-sm">
        <li className="flex justify-between">
          <span className="text-muted-foreground">Viagens no período</span>
          <span className="font-semibold">{card.trips.length}</span>
        </li>
        <li className="flex justify-between">
          <span className="text-muted-foreground">Animais perdidos</span>
          <span
            className={card.lostAnimals > 0 ? "font-semibold text-destructive" : "font-semibold"}
          >
            {card.lostAnimals}
          </span>
        </li>
        <li className="flex justify-between">
          <span className="text-muted-foreground">Comissão (10% - perdas)</span>
          <span className="font-bold text-primary">{formatBRL(card.commission)}</span>
        </li>
        {card.manualCommissionsTotal > 0 && (
          <li className="flex justify-between">
            <span className="text-muted-foreground">Comissões manuais</span>
            <span className="font-bold text-primary">{formatBRL(card.manualCommissionsTotal)}</span>
          </li>
        )}
      </ul>

      <div className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Vales no período</span>
          <span className="font-semibold text-destructive">{formatBRL(card.valesTotal)}</span>
        </div>
        {card.previousCarriedVales > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Vales do período anterior</span>
            <span className="font-semibold text-destructive">
              {formatBRL(card.previousCarriedVales)}
            </span>
          </div>
        )}
        {card.previousShortfall > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Saldo devedor anterior</span>
            <span className="font-semibold text-emerald-600">
              {formatBRL(card.previousShortfall)}
            </span>
          </div>
        )}
        {card.descontosTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Descontos no período</span>
            <span className="font-semibold text-destructive">{formatBRL(card.descontosTotal)}</span>
          </div>
        )}
        {card.bonusTotal > 0 && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Bônus no período</span>
            <span className="font-semibold text-emerald-600">{formatBRL(card.bonusTotal)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ajuda de custo</span>
          <span className={`font-semibold ${ajudaCustoOk ? "text-emerald-600" : "text-amber-600"}`}>
            {formatBRL(card.ajudaCustoTotal)}
            {!ajudaCustoOk && ` (mín. ${formatBRL(ajudaCustoMax)})`}
          </span>
        </div>
      </div>

      {/* Recent entries */}
      {card.allEntriesSinceLastPayment.length > 0 && (
        <div className="mt-3 max-h-40 overflow-y-auto border-t border-border pt-2">
          {card.allEntriesSinceLastPayment
            .slice()
            .sort((a, b) => b.date.localeCompare(a.date))
            .map((e) => (
              <div key={e.id} className="flex items-center justify-between py-1 text-xs">
                <span className="flex items-center gap-1.5">
                  {e.type === "vale" && <Wallet className="h-3 w-3 text-destructive" />}
                  {e.type === "ajuda_custo" && <Gift className="h-3 w-3 text-amber-600" />}
                  {e.type === "desconto" && <TrendingDown className="h-3 w-3 text-destructive" />}
                  {e.type === "bonus" && <TrendingUp className="h-3 w-3 text-emerald-600" />}
                  {e.type === "comissao" && <HandCoins className="h-3 w-3 text-primary" />}
                  {formatDateBR(e.date)} · {ENTRY_TYPE_LABEL[e.type]}: {formatBRL(e.amount)}
                  {e.description && ` — ${e.description}`}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={() => removeEntry(e.id)}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
                {editorMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    title="Editar JSON"
                    onClick={() => {
                      setJsonEditEntry(e);
                      setJsonEditEntryOpen(true);
                    }}
                  >
                    <Code2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Past payments */}
      {card.pastPayments.length > 0 && (
        <div className="mt-3 max-h-32 overflow-y-auto border-t border-border pt-2">
          {card.pastPayments
            .slice()
            .reverse()
            .map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1 text-xs">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {formatDateBR(p.date)} · Pago: {formatBRL(p.paidAmount)}
                  {p.excessAsVale > 0 && ` · Excesso: ${formatBRL(p.excessAsVale)}`}
                  {p.shortfall > 0 && ` · Falta: ${formatBRL(p.shortfall)}`}
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => onPDF(card, p)}
                  >
                    <FileDown className="h-3 w-3" />
                  </Button>
                  {editorMode && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      title="Editar JSON"
                      onClick={() => onEditPayment(p)}
                    >
                      <Code2 className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => onRemovePayment(p.id)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Open payment indicator */}
      {card.openPayment && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <Clock className="h-3 w-3" />
          Pagamento em aberto desde {formatDateBR(card.openPayment.date)}
        </div>
      )}

      {/* Disable reasons */}
      {!canPay && (
        <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          <div>
            <p className="font-semibold">Não é possível pagar a comissão:</p>
            <ul className="ml-3 list-disc">
              {disableReasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={!canPay} onClick={onPay}>
          <HandCoins className="mr-1 h-3 w-3" /> Pagar comissão
        </Button>
        <Button size="sm" variant="outline" onClick={onAddEntry}>
          <Plus className="mr-1 h-3 w-3" /> Lançar movimento
        </Button>
      </div>

      <JsonEditorDialog
        open={jsonEditEntryOpen}
        onOpenChange={setJsonEditEntryOpen}
        title={`Editar lançamento — ${jsonEditEntry?.date ?? ""}`}
        data={jsonEditEntry}
        onSave={(updated) => {
          if (jsonEditEntry && updated && typeof updated === "object") {
            setEntries((prev) =>
              prev.map((e) =>
                e.id === jsonEditEntry.id ? ({ ...e, ...updated } as DriverEntry) : e,
              ),
            );
          }
        }}
      />
    </Card>
  );
}

function PayCommissionDialog({
  driverId,
  card,
  ajudaCustoMax,
  onClose,
  onSaved,
}: {
  driverId: string;
  card: DriverPeriodCard;
  ajudaCustoMax: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [commissionPayments, setCommissionPayments] = useCommissionPayments();
  const [, setEntries] = useDriverEntries();
  const [valeDeducted, setValeDeducted] = useState(() => {
    const vales =
      card.allEntriesSinceLastPayment
        .filter((e) => e.type === "vale")
        .reduce((s, e) => s + e.amount, 0) + card.previousCarriedVales;
    return String(vales);
  });
  const [paidAmountInput, setPaidAmountInput] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [periodEnd, setPeriodEnd] = useState(new Date().toISOString().slice(0, 10));

  // Recompute values based on periodEnd to fix visual bug where trips
  // after periodEnd were still being shown/counted
  const visibleTrips = useMemo(
    () => card.trips.filter((t) => t.date <= periodEnd),
    [card.trips, periodEnd],
  );
  const visibleTripIds = visibleTrips.map((t) => t.id);
  const visibleCommission = computeCommissionForTrips(visibleTrips);
  const visibleEntries = card.allEntriesSinceLastPayment;
  const visibleManualCommissionsTotal = visibleEntries
    .filter((e) => e.type === "comissao")
    .reduce((s, e) => s + e.amount, 0);
  const visibleValesTotal =
    visibleEntries.filter((e) => e.type === "vale").reduce((s, e) => s + e.amount, 0) +
    card.previousCarriedVales;
  const { consumed: visibleAjudaCusto, excess: ajudaCustoExcess, consumedEntryIds, partialEntry } =
    capAjudaCusto(visibleEntries, ajudaCustoMax, 0);
  const visibleDescontosTotal = visibleEntries
    .filter((e) => e.type === "desconto")
    .reduce((s, e) => s + e.amount, 0);
  const visibleBonusTotal = visibleEntries
    .filter((e) => e.type === "bonus")
    .reduce((s, e) => s + e.amount, 0);

  const totalCommission = visibleCommission + visibleManualCommissionsTotal;
  const totalVales = visibleValesTotal;
  const ajudaCusto = visibleAjudaCusto;
  const ajudaOk = ajudaCusto >= ajudaCustoMax;

  const valeD = Math.min(Number(valeDeducted) || 0, totalVales);
  const remainingVales = Math.max(0, totalVales - valeD);

  // Total the driver earned this period, before any vale deduction
  const grossEarnings =
    totalCommission + visibleBonusTotal - visibleDescontosTotal + card.previousShortfall;

  // balanceDue = grossEarnings - only the vales the user chose to deduct now.
  // Vales not deducted remain as remainingVales for the next period.
  const balanceDue = grossEarnings - valeD;

  const paidAmount = Number(paidAmountInput.replace(",", ".")) || 0;

  // If paid > balanceDue: excess becomes vale next period
  // If paid < balanceDue: shortfall carries forward
  const excessAsVale = Math.max(0, paidAmount - balanceDue);
  const shortfall = Math.max(0, balanceDue - paidAmount);

  const finalizeReasons: string[] = [];
  if (visibleTrips.length === 0) finalizeReasons.push("Não há viagens no período selecionado.");
  if (!ajudaOk)
    finalizeReasons.push(
      `Ajuda de custo (${formatBRL(ajudaCusto)}) é menor que o mínimo de ${formatBRL(ajudaCustoMax)}.`,
    );
  if (!payDate) finalizeReasons.push("Informe a data do pagamento.");
  if (!periodEnd) finalizeReasons.push("Informe a data final do período.");
  if (paidAmount < 0) finalizeReasons.push("O valor pago não pode ser negativo.");
  if (valeD < 0) finalizeReasons.push("O vale a descontar não pode ser negativo.");
  if (valeD > totalVales)
    finalizeReasons.push(
      `O vale a descontar (${formatBRL(valeD)}) é maior que o total de vales (${formatBRL(totalVales)}).`,
    );
  const canFinalize = finalizeReasons.length === 0;

  const save = () => {
    if (!canFinalize) {
      if (!ajudaOk) {
        toast.error(`Ajuda de custo deve ser >= ${formatBRL(ajudaCustoMax)}`);
      }
      if (valeD > totalVales) {
        toast.error(`Vale a descontar não pode ser maior que ${formatBRL(totalVales)}.`);
      }
      return;
    }

    // Only mark consumed ajuda de custo entries as paid.
    // Non-ajuda-custo entries are always fully consumed.
    // A partially-consumed ajuda de custo entry has its amount reduced to the
    // remaining excess so it stays open for the next payment.
    const nonAjudaIds = visibleEntries
      .filter((e) => e.type !== "ajuda_custo")
      .map((e) => e.id);
    const paidEntryIds = [...nonAjudaIds, ...consumedEntryIds];

    const payment: CommissionPayment = {
      id: uid(),
      driverId,
      date: payDate,
      periodStart: card.periodStart,
      periodEnd,
      tripIds: visibleTripIds,
      entryIds: paidEntryIds,
      commissionValue: visibleCommission,
      manualCommissionsTotal: visibleManualCommissionsTotal,
      bonusTotal: visibleBonusTotal,
      descontosTotal: visibleDescontosTotal,
      valesTotal: totalVales,
      valeDeducted: valeD,
      ajudaCusto,
      remainingVales,
      previousCarriedVales: card.previousCarriedVales,
      previousShortfall: card.previousShortfall,
      balanceDue,
      excessAsVale,
      shortfall,
      paidAmount,
      finalized: true,
      createdAt: new Date().toISOString(),
    };

    setCommissionPayments((prev) => [...prev, payment]);

    // Reduce the partially-consumed ajuda de custo entry to its remaining
    // excess so it stays open for the next payment period.
    if (partialEntry) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === partialEntry.id ? { ...e, amount: partialEntry.excessAmount } : e,
        ),
      );
    }

    toast.success(`Pagamento registrado: ${formatBRL(paidAmount)}`);
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar comissão — {card.driverName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 overflow-y-auto">
          <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Período</span>
              <span className="font-semibold">
                {card.periodStart ? formatDateBR(card.periodStart) : "Início"} →{" "}
                {formatDateBR(periodEnd)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Viagens no período</span>
              <span className="font-semibold">{visibleTrips.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Comissão (10% - perdas)</span>
              <span className="font-bold text-primary">{formatBRL(totalCommission)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vales acumulados</span>
              <span className="font-semibold text-destructive">{formatBRL(totalVales)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Ajuda de custo</span>
              <span className="font-semibold text-emerald-600">{formatBRL(ajudaCusto)}</span>
            </div>
          </div>

          <div>
            <Label>Data final do período</Label>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Apenas as viagens até esta data entram neste pagamento. Vales, bônus, descontos,
              ajudas de custo e comissões manuais em aberto são incluídos independente da data.
            </p>
          </div>

          <div>
            <Label>Data do pagamento</Label>
            <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Data em que o pagamento foi efetivado ao motorista.
            </p>
          </div>

          <div>
            <Label>Vale a descontar (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max={totalVales}
              value={valeDeducted}
              onChange={(e) => setValeDeducted(e.target.value)}
              placeholder={String(totalVales)}
            />
            <div className="mt-1 flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setValeDeducted(String(totalVales))}
              >
                Descontar tudo
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={() => setValeDeducted("0")}
              >
                Não descontar
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Máximo: {formatBRL(totalVales)}. Descontar um vale reduz o saldo a pagar. O que não
              for descontado ({formatBRL(remainingVales)}) fica para o próximo pagamento.
            </p>
          </div>

          <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total a receber (sem descontar vales)</span>
              <span className="font-semibold">{formatBRL(grossEarnings)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vales descontados</span>
              <span className="font-semibold text-destructive">- {formatBRL(valeD)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Vales restantes (próx. pagto)</span>
              <span className="font-semibold">{formatBRL(remainingVales)}</span>
            </div>
            <div className="mt-1 flex justify-between border-t border-border pt-1">
              <span className="font-bold">Saldo a pagar</span>
              <span className="font-bold text-primary">{formatBRL(balanceDue)}</span>
            </div>
          </div>

          <div>
            <Label>Valor pago (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={paidAmountInput}
              onChange={(e) => setPaidAmountInput(e.target.value)}
              placeholder={String(balanceDue)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Informe quanto você está pagando. Se pagar a mais, o excesso vira vale no próximo
              período. Se pagar a menos, a falta será abatida no próximo pagamento.
            </p>
          </div>

          <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
            {excessAsVale > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Excesso como vale (próx. pagto)</span>
                <span className="font-semibold text-amber-600">{formatBRL(excessAsVale)}</span>
              </div>
            )}
            {shortfall > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Falta (próx. pagto)</span>
                <span className="font-semibold text-destructive">{formatBRL(shortfall)}</span>
              </div>
            )}
            {excessAsVale === 0 && shortfall === 0 && paidAmount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pagamento exato</span>
                <span className="font-semibold text-emerald-600">Sem excesso ou falta</span>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="flex-col items-stretch gap-2 sm:flex-col sm:items-stretch">
          {!canFinalize && (
            <ul className="mb-1 space-y-1 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              {finalizeReasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={!canFinalize}>
              Finalizar pagamento
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddEntryDialog({
  driverId,
  card,
  ajudaCustoMax,
  onClose,
}: {
  driverId: string;
  card: DriverPeriodCard;
  ajudaCustoMax: number;
  onClose: () => void;
}) {
  const [, setEntries] = useDriverEntries();
  const [entryType, setEntryType] = useState<DriverEntryType>("vale");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");

  const isNegative = entryType === "vale" || entryType === "desconto";
  const isPositive = entryType === "bonus" || entryType === "comissao";
  const isNeutral = entryType === "ajuda_custo";
  const ajudaCustoAlreadyMet = card.ajudaCustoTotal >= ajudaCustoMax;
  const newAmount = parseFloat(amount.replace(",", ".")) || 0;
  const ajudaCustoWouldExceed =
    entryType === "ajuda_custo" && card.ajudaCustoTotal + newAmount > ajudaCustoMax;
  const blockAjudaCusto =
    (entryType === "ajuda_custo" && ajudaCustoAlreadyMet) || ajudaCustoWouldExceed;
  const minDate = card.periodStart || "";

  const save = () => {
    const n = parseFloat(amount.replace(",", "."));
    if (!isFinite(n) || n <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!date) {
      toast.error("Informe a data");
      return;
    }
    if (blockAjudaCusto) {
      if (ajudaCustoWouldExceed) {
        toast.error(
          `A soma da ajuda de custo (${formatBRL(card.ajudaCustoTotal)} + ${formatBRL(n)}) ultrapassa o máximo de ${formatBRL(ajudaCustoMax)}.`,
        );
      } else {
        toast.error(
          `A ajuda de custo já atingiu o máximo de ${formatBRL(ajudaCustoMax)} neste período.`,
        );
      }
      return;
    }
    if (minDate && date <= minDate) {
      toast.error(
        `A data não pode ser anterior ou igual ao último pagamento (${formatDateBR(minDate)}).`,
      );
      return;
    }

    const entry: DriverEntry = {
      id: uid(),
      driverId,
      date,
      type: entryType,
      amount: n,
      description: description.trim() || undefined,
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => [...prev, entry]);
    toast.success(`${ENTRY_TYPE_LABEL[entryType]} lançado: ${formatBRL(n)}`);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lançar movimento — {card.driverName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Tipo</Label>
            <Select value={entryType} onValueChange={(v) => setEntryType(v as DriverEntryType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vale">Vale (desconta do saldo)</SelectItem>
                <SelectItem value="ajuda_custo" disabled={ajudaCustoAlreadyMet}>
                  Ajuda de custo {ajudaCustoAlreadyMet ? "(já no máximo)" : "(não afeta o saldo)"}
                </SelectItem>
                <SelectItem value="comissao">Comissão manual (aumenta o saldo)</SelectItem>
                <SelectItem value="desconto">Desconto (reduz o saldo)</SelectItem>
                <SelectItem value="bonus">Bônus (aumenta o saldo)</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              {isNegative && "Este valor será subtraído do saldo da comissão."}
              {isPositive && "Este valor será somado ao saldo da comissão."}
              {isNeutral &&
                (blockAjudaCusto
                  ? ajudaCustoWouldExceed
                    ? `A soma ultrapassaria o máximo de ${formatBRL(ajudaCustoMax)} (já lançado: ${formatBRL(card.ajudaCustoTotal)}).`
                    : `A ajuda de custo já atingiu o máximo de ${formatBRL(ajudaCustoMax)} neste período.`
                  : "A ajuda de custo não afeta o saldo, mas precisa atingir o mínimo para liberar o pagamento.")}
            </p>
          </div>

          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 250,00"
            />
          </div>

          <div>
            <Label>Data</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={minDate || undefined}
            />
            {minDate && (
              <p className="mt-1 text-xs text-muted-foreground">
                Não pode ser antes do último pagamento ({formatDateBR(minDate)}).
              </p>
            )}
          </div>

          <div>
            <Label>Descrição (opcional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Vale para combustível"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={blockAjudaCusto}>
            Lançar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
