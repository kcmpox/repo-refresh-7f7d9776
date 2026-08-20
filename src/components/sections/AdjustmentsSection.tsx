import { useMemo, useState, useRef } from "react";
import {
  usePayments,
  useAdjustments,
  useBonuses,
  useActiveTrips,
  useTrucks,
  useFuelings,
  useExpenses,
  useTolls,
  uid,
  formatBRL,
  formatDateBR,
  paymentDiscrepancy,
  paymentFinalValue,
  sumAdjustments,
  type PaymentAdjustment,
  type PricingBonus,
  type Payment,
} from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Download, Upload, FileText, Pencil } from "lucide-react";
import { TriangleAlert as AlertTriangle, Plus, Trash2, TrendingUp, History, FileDown, Calculator, CircleCheck as CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  buildPdfDoc,
  previewPdf,
  pdfKpiRow,
  pdfSectionTitle,
  pdfTableLayout,
  PDF_COLORS,
  th,
} from "@/lib/pdf-theme";

const TEMPLATES = [
  "Frigorífico descontou frete",
  "Peso menor no abate",
  "Bônus de tabela retroativo",
  "Ressarcimento de despesa",
  "Correção de valor da viagem",
  "Diferença não justificada",
];

const TYPE_LABEL: Record<PaymentAdjustment["type"], string> = {
  desconto: "Desconto",
  ressarcimento: "Ressarcimento",
  bonus: "Bônus",
  correcao: "Correção",
};

const TYPE_EXPLANATION: Record<PaymentAdjustment["type"], string> = {
  desconto: "O frigorífico descontou um valor do seu recebimento (ex: frete não pago). Reduz o líquido.",
  ressarcimento: "O frigorífico devolveu um valor que havia sido descontado. Aumenta o líquido.",
  bonus: "Bônus retroativo da tabela de preços, aplicado sobre o bruto de um mês. Aumenta o líquido.",
  correcao: "Correção manual de valor, positiva ou negativa. Use para ajustes livres.",
};

const STATUS_LABEL: Record<PaymentAdjustment["status"], string> = {
  aberto: "Aberto",
  cobrado: "Cobrado",
  aceito: "Aceito como está",
  recebido: "Recebido",
};

const STATUS_EXPLANATION: Record<PaymentAdjustment["status"], string> = {
  aberto: "O ajuste foi registrado mas ainda não foi cobrado nem recebido do frigorífico.",
  cobrado: "A cobrança foi feita ao frigorífico, aguardando retorno.",
  aceito: "A diferença foi aceita como está, sem cobrança. Zera a diferença.",
  recebido: "O valor do ajuste já foi recebido do frigorífico.",
};

export function AdjustmentsSection() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-3xl font-bold">Ajustes de recebimento</h2>
        <p className="text-muted-foreground">
          Reconcilie diferenças, aplique bônus retroativos e mantenha rastreabilidade
          das cobranças com o frigorífico.
        </p>
      </div>
      <Tabs defaultValue="pendentes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pendentes">
            <AlertTriangle className="mr-1 h-4 w-4" /> Pendentes
          </TabsTrigger>
          <TabsTrigger value="ajustes">
            <Calculator className="mr-1 h-4 w-4" /> Ajustes
          </TabsTrigger>
          <TabsTrigger value="bonus">
            <TrendingUp className="mr-1 h-4 w-4" /> Bônus de tabela
          </TabsTrigger>
          <TabsTrigger value="auditoria">
            <History className="mr-1 h-4 w-4" /> Auditoria
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          <PendingTab />
        </TabsContent>
        <TabsContent value="ajustes">
          <AdjustmentsTab />
        </TabsContent>
        <TabsContent value="bonus">
          <BonusTab />
        </TabsContent>
        <TabsContent value="auditoria">
          <AuditTab />
        </TabsContent>
        <TabsContent value="registro">
          <RegistryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Pendentes ----------

function PendingTab() {
  const [payments] = usePayments();
  const [adjustments, setAdjustments] = useAdjustments();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const pending = useMemo(() => {
    return payments
      .filter((p) => {
        const ymd = p.date.slice(0, 10);
        if (dateFrom && ymd < dateFrom) return false;
        if (dateTo && ymd > dateTo) return false;
        return Math.abs(paymentDiscrepancy(p, adjustments)) > 0.005;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [payments, adjustments, dateFrom, dateTo]);

  const totalDiff = pending.reduce(
    (s, p) => s + paymentDiscrepancy(p, adjustments),
    0,
  );

  const acceptAsIs = (p: Payment) => {
    const diff = paymentDiscrepancy(p, adjustments);
    setAdjustments((prev) => [
      ...prev,
      {
        id: uid(),
        paymentId: p.id,
        type: diff < 0 ? "desconto" : "ressarcimento",
        amount: -diff, // zera a diferença
        note: "Aceito como está",
        createdAt: new Date().toISOString(),
        status: "aceito",
      },
    ]);
    toast.success("Diferença zerada com ajuste automático");
  };

  return (
    <div className="space-y-4">
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
          <div className="ml-auto text-right">
            <p className="text-xs text-muted-foreground">
              {pending.length} recebimento(s) com diferença
            </p>
            <p
              className={`text-lg font-bold ${
                totalDiff >= 0 ? "text-emerald-600" : "text-destructive"
              }`}
            >
              {totalDiff >= 0 ? "+" : "-"} {formatBRL(Math.abs(totalDiff))}
            </p>
          </div>
        </div>
      </Card>

      {pending.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum recebimento com diferença pendente. Tudo em dia.
        </Card>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => {
            const finalV = paymentFinalValue(p, adjustments);
            const diff = paymentDiscrepancy(p, adjustments);
            const linked = adjustments.filter((a) => a.paymentId === p.id);
            return (
              <Card key={p.id} className="p-4 shadow-soft">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Recebimento {formatDateBR(p.date)}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline">
                        Esperado: {formatBRL(p.expectedValue)}
                      </Badge>
                      <Badge variant="outline">
                        Recebido: {formatBRL(p.receivedValue)}
                      </Badge>
                      {linked.length > 0 && (
                        <Badge variant="secondary">
                          {linked.length} ajuste(s) · líquido{" "}
                          {formatBRL(finalV)}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Diferença</p>
                      <p
                        className={`text-lg font-bold ${
                          diff >= 0 ? "text-emerald-600" : "text-destructive"
                        }`}
                      >
                        {diff >= 0 ? "+" : "-"} {formatBRL(Math.abs(diff))}
                      </p>
                    </div>
                    <AdjustmentDialog payment={p}>
                      <Button variant="outline" size="sm">
                        <Plus className="mr-1 h-3 w-3" /> Cobrar / Ajustar
                      </Button>
                    </AdjustmentDialog>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => acceptAsIs(p)}
                      title="Marcar como aceito e zerar diferença"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Aceitar
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

// ---------- Ajustes (CRUD) ----------

function AdjustmentsTab() {
  const [adjustments, setAdjustments] = useAdjustments();
  const [payments] = usePayments();

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentAdjustment[]>();
    for (const a of adjustments) {
      const arr = map.get(a.paymentId) ?? [];
      arr.push(a);
      map.set(a.paymentId, arr);
    }
    return Array.from(map.entries())
      .map(([pid, list]) => {
        const p = payments.find((x) => x.id === pid);
        return { payment: p, list };
      })
      .filter((g) => g.payment)
      .sort(
        (a, b) =>
          (b.payment?.date ?? "").localeCompare(a.payment?.date ?? ""),
      );
  }, [adjustments, payments]);

  const remove = (id: string) => {
    if (!window.confirm("Remover este ajuste?")) return;
    setAdjustments((prev) => prev.filter((a) => a.id !== id));
    toast.success("Ajuste removido");
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {adjustments.length} ajuste(s) registrados em {grouped.length}{" "}
            recebimento(s).
          </p>
          <NewFreeAdjustmentDialog />
        </div>
      </Card>

      {grouped.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum ajuste registrado ainda.
        </Card>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => (
            <Card key={g.payment!.id} className="p-4 shadow-soft">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    Recebimento {formatDateBR(g.payment!.date)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Esperado {formatBRL(g.payment!.expectedValue)} · Recebido{" "}
                    {formatBRL(g.payment!.receivedValue)} · Líquido{" "}
                    {formatBRL(paymentFinalValue(g.payment!, adjustments))}
                  </p>
                </div>
                <div className="flex gap-2">
                  <AdjustmentDialog payment={g.payment!}>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-3 w-3" /> Novo ajuste
                    </Button>
                  </AdjustmentDialog>
                  <PaymentPdfButton payment={g.payment!} />
                </div>
              </div>
              <div className="space-y-2">
                {g.list.map((a) => (
                  <div
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-secondary/30 p-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="secondary">{TYPE_LABEL[a.type]}</Badge>
                        <Badge variant="outline">{STATUS_LABEL[a.status]}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDateBR(a.createdAt)}
                        </span>
                      </div>
                      {a.note && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {a.note}
                        </p>
                      )}
                    </div>
                    <span
                      className={`font-semibold ${
                        a.amount >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}
                    >
                      {a.amount >= 0 ? "+" : "-"}
                      {formatBRL(Math.abs(a.amount))}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(a.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewFreeAdjustmentDialog() {
  const [payments] = usePayments();
  const [paymentId, setPaymentId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const p = payments.find((x) => x.id === paymentId);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1 h-3 w-3" /> Novo ajuste
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Escolha o recebimento</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Recebimento</Label>
          <Select value={paymentId} onValueChange={setPaymentId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {payments
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((pp) => (
                  <SelectItem key={pp.id} value={pp.id}>
                    {formatDateBR(pp.date)} — {formatBRL(pp.receivedValue)}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          {p && (
            <AdjustmentDialog
              payment={p}
              onSaved={() => {
                setOpen(false);
                setPaymentId("");
              }}
            >
              <Button className="mt-2 w-full">Continuar</Button>
            </AdjustmentDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AdjustmentDialog({
  payment,
  children,
  onSaved,
}: {
  payment: Payment;
  children: React.ReactNode;
  onSaved?: () => void;
}) {
  const [, setAdjustments] = useAdjustments();
  const [trips] = useActiveTrips();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PaymentAdjustment["type"]>("correcao");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [tripId, setTripId] = useState<string>("");
  const [status, setStatus] = useState<PaymentAdjustment["status"]>("aberto");

  const linkedTrips = trips.filter((t) => payment.tripIds.includes(t.id));

  const save = () => {
    const n = parseFloat(amount.replace(",", "."));
    if (!isFinite(n) || n === 0) {
      toast.error("Informe um valor diferente de zero");
      return;
    }
    // Sinal automático: descontos e correções negativas são negativos.
    const signed =
      type === "desconto"
        ? -Math.abs(n)
        : type === "ressarcimento" || type === "bonus"
          ? Math.abs(n)
          : n; // correção mantém sinal informado
    setAdjustments((prev) => [
      ...prev,
      {
        id: uid(),
        paymentId: payment.id,
        tripId: tripId || undefined,
        type,
        amount: signed,
        note,
        createdAt: new Date().toISOString(),
        status,
      },
    ]);
    toast.success("Ajuste registrado");
    setOpen(false);
    setAmount("");
    setNote("");
    setTripId("");
    onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Novo ajuste · Recebimento {formatDateBR(payment.date)}
          </DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Tipo</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as PaymentAdjustment["type"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desconto">
                  Desconto (frigorífico descontou)
                </SelectItem>
                <SelectItem value="ressarcimento">
                  Ressarcimento (frigorífico devolveu)
                </SelectItem>
                <SelectItem value="bonus">Bônus de tabela</SelectItem>
                <SelectItem value="correcao">
                  Correção manual (± livre)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">{TYPE_EXPLANATION[type]}</p>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as PaymentAdjustment["status"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">{STATUS_EXPLANATION[status]}</p>
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Ex: 250,00"
            />
            {type === "correcao" && (
              <p className="mt-1 text-xs text-muted-foreground">
                Use valor negativo para reduzir o líquido.
              </p>
            )}
          </div>
          <div>
            <Label>Viagem (opcional)</Label>
            <Select
              value={tripId || "__none__"}
              onValueChange={(v) => setTripId(v === "__none__" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— sem viagem —</SelectItem>
                {linkedTrips.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {formatDateBR(t.date)} · {t.origin}→{t.destination}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Observação</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Motivo, referência de conversa, etc."
              rows={3}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {TEMPLATES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNote((n) => (n ? n + " · " + t : t))}
                  className="rounded-full border border-border bg-secondary px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live before/after preview */}
        {(() => {
          const n = parseFloat(amount.replace(",", "."));
          if (!isFinite(n) || n === 0) return null;
          const signed =
            type === "desconto"
              ? -Math.abs(n)
              : type === "ressarcimento" || type === "bonus"
                ? Math.abs(n)
                : n;
          const before = paymentFinalValue(payment, []);
          const after = before + signed;
          return (
            <div className="rounded-md border border-border bg-secondary/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Líquido atual</span>
                <span className="font-semibold">{formatBRL(before)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ajuste</span>
                <span className={signed >= 0 ? "text-emerald-600" : "text-destructive"}>
                  {signed >= 0 ? "+" : "-"} {formatBRL(Math.abs(signed))}
                </span>
              </div>
              <div className="mt-1 flex justify-between border-t border-border pt-1">
                <span className="font-bold">Líquido após ajuste</span>
                <span className="font-bold text-primary">{formatBRL(after)}</span>
              </div>
            </div>
          );
        })()}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar ajuste</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Bônus de tabela ----------

function BonusTab() {
  const [bonuses, setBonuses] = useBonuses();
  const [payments] = usePayments();
  const [trips] = useActiveTrips();
  const [adjustments, setAdjustments] = useAdjustments();
  const [monthYYYYMM, setMonth] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [percent, setPercent] = useState("");
  const [note, setNote] = useState("");

  const preview = useMemo(() => {
    const pct = parseFloat(percent.replace(",", ".")) / 100;
    if (!isFinite(pct) || pct <= 0) return null;
    const affected = payments.filter((p) => {
      const tripDates = trips
        .filter((t) => p.tripIds.includes(t.id))
        .map((t) => t.date.slice(0, 7));
      return tripDates.some((d) => d === monthYYYYMM);
    });
    const items = affected.map((p) => {
      const monthTrips = trips.filter(
        (t) => p.tripIds.includes(t.id) && t.date.slice(0, 7) === monthYYYYMM,
      );
      const monthGross = monthTrips.reduce((s, t) => s + t.finalValue, 0);
      return { payment: p, monthGross, bonus: monthGross * pct };
    });
    return { pct, items, total: items.reduce((s, it) => s + it.bonus, 0) };
  }, [payments, trips, percent, monthYYYYMM]);

  const apply = () => {
    if (!preview || preview.items.length === 0) {
      toast.error("Nada a aplicar");
      return;
    }
    const pct = preview.pct;
    const bonus: PricingBonus = {
      id: uid(),
      monthYYYYMM,
      percent: pct,
      note,
      createdAt: new Date().toISOString(),
    };
    setBonuses((prev) => [...prev, bonus]);
    setAdjustments((prev) => [
      ...prev,
      ...preview.items.map(
        (it): PaymentAdjustment => ({
          id: uid(),
          paymentId: it.payment.id,
          type: "bonus",
          amount: it.bonus,
          note: `Bônus de tabela ${monthYYYYMM} (+${(pct * 100).toFixed(2)}%)${
            note ? " — " + note : ""
          }`,
          createdAt: new Date().toISOString(),
          bonusId: bonus.id,
          status: "aberto",
        }),
      ),
    ]);
    toast.success(
      `${preview.items.length} recebimento(s) atualizados (+${formatBRL(preview.total)})`,
    );
    setPercent("");
    setNote("");
  };

  const rollback = (bonusId: string) => {
    if (!window.confirm("Reverter este bônus e remover ajustes derivados?"))
      return;
    setAdjustments((prev) => prev.filter((a) => a.bonusId !== bonusId));
    setBonuses((prev) => prev.filter((b) => b.id !== bonusId));
    toast.success("Bônus revertido");
  };

  return (
    <div className="space-y-4">
      <Card className="p-5 shadow-soft">
        <p className="mb-3 font-semibold">Novo bônus retroativo</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Mês (AAAA-MM)</Label>
            <Input
              type="month"
              value={monthYYYYMM}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div>
            <Label>Percentual (%)</Label>
            <Input
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="Ex: 14"
            />
          </div>
          <div className="sm:col-span-3">
            <Label>Observação</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: mensagem do frigorífico dizendo que aumentou tabela"
            />
          </div>
        </div>
        {preview && (
          <div className="mt-3 rounded-md border border-border bg-secondary/40 p-3 text-sm">
            <p className="mb-1 font-semibold">
              Prévia: {preview.items.length} recebimento(s) impactado(s)
            </p>
            <p className="text-emerald-600">
              Bônus total: +{formatBRL(preview.total)}
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
              {preview.items.slice(0, 5).map((it) => (
                <li key={it.payment.id}>
                  {formatDateBR(it.payment.date)} — bruto do mês{" "}
                  {formatBRL(it.monthGross)} → +{formatBRL(it.bonus)}
                </li>
              ))}
              {preview.items.length > 5 && (
                <li>... e mais {preview.items.length - 5}</li>
              )}
            </ul>
          </div>
        )}
        <div className="mt-3 flex justify-end">
          <Button onClick={apply} disabled={!preview}>
            <Sparkles className="mr-1 h-4 w-4" /> Aplicar bônus
          </Button>
        </div>
      </Card>

      <Card className="p-4 shadow-soft">
        <p className="mb-3 font-semibold">Bônus aplicados</p>
        {bonuses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum bônus aplicado.</p>
        ) : (
          <div className="space-y-2">
            {bonuses
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((b) => {
                const derived = adjustments.filter((a) => a.bonusId === b.id);
                const total = sumAdjustments(derived);
                return (
                  <div
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-2 text-sm"
                  >
                    <div>
                      <p className="font-semibold">
                        {b.monthYYYYMM} · +{(b.percent * 100).toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {derived.length} recebimento(s) · total{" "}
                        {formatBRL(total)} · aplicado{" "}
                        {formatDateBR(b.createdAt)}
                      </p>
                      {b.note && (
                        <p className="text-xs text-muted-foreground">
                          {b.note}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => rollback(b.id)}
                    >
                      <Trash2 className="mr-1 h-3 w-3 text-destructive" />
                      Reverter
                    </Button>
                  </div>
                );
              })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------- Auditoria ----------

function AuditTab() {
  const [adjustments] = useAdjustments();
  const [payments] = usePayments();
  const [typeFilter, setTypeFilter] = useState<string>("__all__");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const filtered = useMemo(() => {
    return adjustments
      .filter((a) => {
        if (typeFilter !== "__all__" && a.type !== typeFilter) return false;
        const ymd = a.createdAt.slice(0, 10);
        if (dateFrom && ymd < dateFrom) return false;
        if (dateTo && ymd > dateTo) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [adjustments, typeFilter, dateFrom, dateTo]);

  const stats = useMemo(() => {
    let desc = 0,
      ress = 0,
      bon = 0,
      corr = 0;
    for (const a of filtered) {
      if (a.type === "desconto") desc += a.amount;
      else if (a.type === "ressarcimento") ress += a.amount;
      else if (a.type === "bonus") bon += a.amount;
      else corr += a.amount;
    }
    return { desc, ress, bon, corr, net: desc + ress + bon + corr };
  }, [filtered]);

  const exportCsv = () => {
    const header = "data;tipo;valor;recebimento;status;observacao";
    const rows = filtered.map((a) => {
      const p = payments.find((x) => x.id === a.paymentId);
      const date = formatDateBR(a.createdAt);
      const pay = p ? formatDateBR(p.date) : "?";
      const note = (a.note || "").replace(/[;\n]/g, " ");
      return `${date};${TYPE_LABEL[a.type]};${a.amount.toFixed(2)};${pay};${STATUS_LABEL[a.status]};${note}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-ajustes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">De</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <Label className="text-xs">Até</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-40"
            />
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {Object.entries(TYPE_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={exportCsv} className="ml-auto">
            <FileDown className="mr-1 h-4 w-4" /> Exportar CSV
          </Button>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Descontos" value={stats.desc} tone="danger" />
        <StatCard label="Ressarcimentos" value={stats.ress} tone="success" />
        <StatCard label="Bônus" value={stats.bon} tone="success" />
        <StatCard label="Correções" value={stats.corr} tone="muted" />
        <StatCard label="Saldo líquido" value={stats.net} tone="primary" />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Nenhum registro no período.
        </Card>
      ) : (
        <Card className="p-4 shadow-soft">
          <div className="space-y-2 text-sm">
            {filtered.map((a) => {
              const p = payments.find((x) => x.id === a.paymentId);
              return (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 border-b border-border pb-1"
                >
                  <span className="w-24 text-xs text-muted-foreground">
                    {formatDateBR(a.createdAt)}
                  </span>
                  <Badge variant="secondary">{TYPE_LABEL[a.type]}</Badge>
                  <span className="text-xs">
                    Rec. {p ? formatDateBR(p.date) : "?"}
                  </span>
                  <span className="ml-auto font-semibold">
                    <span
                      className={
                        a.amount >= 0 ? "text-emerald-600" : "text-destructive"
                      }
                    >
                      {a.amount >= 0 ? "+" : "-"}
                      {formatBRL(Math.abs(a.amount))}
                    </span>
                  </span>
                  {a.note && (
                    <span className="w-full text-xs text-muted-foreground">
                      {a.note}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "danger" | "primary" | "muted";
}) {
  const cls =
    tone === "success"
      ? "text-emerald-600"
      : tone === "danger"
        ? "text-destructive"
        : tone === "primary"
          ? "text-primary"
          : "text-muted-foreground";
  return (
    <Card className="p-3 shadow-soft">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${cls}`}>
        {value >= 0 ? "" : "-"}
        {formatBRL(Math.abs(value))}
      </p>
    </Card>
  );
}

// ---------- Botão de PDF do recebimento (com ajustes) ----------

function PaymentPdfButton({ payment }: { payment: Payment }) {
  const [trips] = useActiveTrips();
  const [fuelings] = useFuelings();
  const [expenses] = useExpenses();
  const [tolls] = useTolls();
  const [trucks] = useTrucks();
  const [adjustments] = useAdjustments();

  const generate = async () => {
    try {
      const selTrips = trips.filter((t) => payment.tripIds.includes(t.id));
      const selFuel = fuelings.filter((f) => payment.fuelingIds.includes(f.id));
      const selExp = expenses.filter((e) => payment.expenseIds.includes(e.id));
      const selTolls = tolls.filter((t) => payment.tollIds.includes(t.id));
      const linked = adjustments.filter((a) => a.paymentId === payment.id);
      const finalV = paymentFinalValue(payment, adjustments);
      const adjTotal = sumAdjustments(linked);

      const content: unknown[] = [
        pdfKpiRow([
          { label: "Bruto viagens", value: formatBRL(payment.grossValue) },
          {
            label: "Aluguel",
            value: `- ${formatBRL(payment.rentValue)}`,
            color: PDF_COLORS.muted,
          },
          {
            label: "Descontos",
            value: `- ${formatBRL(payment.deductedValue)}`,
            color: PDF_COLORS.danger,
          },
          {
            label: "Ajustes",
            value: `${adjTotal >= 0 ? "+" : "-"} ${formatBRL(Math.abs(adjTotal))}`,
            color: adjTotal >= 0 ? PDF_COLORS.success : PDF_COLORS.danger,
          },
          {
            label: "Total final",
            value: formatBRL(finalV),
            color: PDF_COLORS.primaryDark,
          },
        ]),
        pdfSectionTitle("Viagens"),
        {
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "*", "*", "auto"],
            body: [
              [th("Data"), th("Caminhão"), th("Origem"), th("Destino"), th("Valor")],
              ...selTrips
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((t) => {
                  const truck = trucks.find((x) => x.id === t.truckId);
                  return [
                    formatDateBR(t.date),
                    truck ? `${truck.name} (${truck.plate})` : "—",
                    t.origin,
                    t.destination,
                    formatBRL(t.finalValue),
                  ];
                }),
            ],
          },
          layout: pdfTableLayout,
          fontSize: 9,
        },
      ];

      if (selFuel.length || selExp.length || selTolls.length) {
        content.push(pdfSectionTitle("Descontos e ressarcimentos"));
        const rows: unknown[][] = [];
        selFuel.forEach((f) => {
          const truck = trucks.find((x) => x.id === f.truckId);
          rows.push([
            formatDateBR(f.date),
            "Combustível",
            truck ? `${truck.name} (${truck.plate})` : "—",
            formatBRL(f.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)),
          ]);
        });
        selExp.forEach((e) => {
          rows.push([
            formatDateBR(e.date),
            "Manutenção",
            e.category,
            formatBRL(e.value),
          ]);
        });
        selTolls.forEach((t) => {
          rows.push([
            formatDateBR(t.dateTime),
            "Pedágio",
            t.tollName,
            formatBRL(t.value),
          ]);
        });
        content.push({
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "*", "auto"],
            body: [
              [th("Data"), th("Tipo"), th("Descrição"), th("Valor")],
              ...rows,
            ],
          },
          layout: pdfTableLayout,
          fontSize: 9,
        });
      }

      // Resumo com ajustes
      content.push(pdfSectionTitle("Resumo financeiro"));
      content.push({
        table: {
          widths: ["*", "auto"],
          body: [
            ["Bruto (viagens)", formatBRL(payment.grossValue)],
            [`Ressarcimentos`, `+ ${formatBRL(payment.reimbursedValue)}`],
            [
              `Aluguel (${(payment.rentPercent * 100).toFixed(0)}%)`,
              `- ${formatBRL(payment.rentValue)}`,
            ],
            ["Descontos", `- ${formatBRL(payment.deductedValue)}`],
            [
              { text: "Valor esperado", bold: true },
              { text: formatBRL(payment.expectedValue), bold: true },
            ],
            ["Recebido do frigorífico", formatBRL(payment.receivedValue)],
            [
              { text: "Ajustes posteriores", bold: true },
              {
                text: `${adjTotal >= 0 ? "+" : "-"} ${formatBRL(Math.abs(adjTotal))}`,
                bold: true,
                color: adjTotal >= 0 ? PDF_COLORS.success : PDF_COLORS.danger,
              },
            ],
            [
              {
                text: "Total final",
                bold: true,
                color: PDF_COLORS.primaryDark,
              },
              { text: formatBRL(finalV), bold: true, color: PDF_COLORS.primaryDark },
            ],
          ],
        },
        layout: pdfTableLayout,
        fontSize: 10,
      });

      if (linked.length > 0) {
        content.push(pdfSectionTitle("Ajustes / observações"));
        content.push({
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "auto", "*"],
            body: [
              [th("Data"), th("Tipo"), th("Valor"), th("Observação")],
              ...linked
                .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                .map((a) => [
                  formatDateBR(a.createdAt),
                  TYPE_LABEL[a.type],
                  `${a.amount >= 0 ? "+" : "-"} ${formatBRL(Math.abs(a.amount))}`,
                  a.note || "",
                ]),
            ],
          },
          layout: pdfTableLayout,
          fontSize: 9,
        });
      }

      if (payment.notes) {
        content.push(pdfSectionTitle("Notas do recebimento"));
        content.push({ text: payment.notes, fontSize: 10 });
      }

      await previewPdf(
        buildPdfDoc({
          title: "Recebimento",
          subtitle: `Data: ${formatDateBR(payment.date)}`,
          content,
        }),
        `recebimento-${payment.date}.pdf`,
      );
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={generate}>
      <FileDown className="mr-1 h-3 w-3" /> PDF (com ajustes)
    </Button>
  );
}

// ---------- Registro de Recebimento (importar / editar / exportar) ----------

type RegistryFile = {
  type?: string;
  version?: number;
  exportedAt?: string;
  payment?: Record<string, unknown>;
  trips?: unknown[];
  fuelings?: unknown[];
  expenses?: unknown[];
  tolls?: unknown[];
  [k: string]: unknown;
};

function RegistryTab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [registry, setRegistry] = useState<RegistryFile | null>(null);
  const [jsonText, setJsonText] = useState("");
  const [editing, setEditing] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as RegistryFile;
      if (!parsed.payment) {
        toast.error("Arquivo inválido: não é um registro de recebimento");
        return;
      }
      setRegistry(parsed);
      setJsonText(JSON.stringify(parsed, null, 2));
      setEditing(false);
      toast.success("Registro carregado");
    } catch {
      toast.error("Erro ao ler o arquivo");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const exportRegistry = () => {
    if (!registry) return;
    const blob = new Blob([JSON.stringify(registry, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const date = (registry.payment as { date?: string })?.date ?? new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `recebimento-${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Registro exportado");
  };

  const saveEdit = () => {
    try {
      const parsed = JSON.parse(jsonText) as RegistryFile;
      setRegistry(parsed);
      setEditing(false);
      toast.success("Registro atualizado");
    } catch {
      toast.error("JSON inválido");
    }
  };

  const payment = registry?.payment as
    | { date?: string; tripIds?: unknown[]; receivedValue?: number; expectedValue?: number }
    | undefined;

  return (
    <div className="space-y-4">
      <Card className="p-4 shadow-soft">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Importar recebimento.json
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleFile}
          />
          {registry && (
            <>
              <Button variant="outline" onClick={exportRegistry}>
                <Download className="mr-1 h-4 w-4" /> Exportar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(!editing);
                  setJsonText(JSON.stringify(registry, null, 2));
                }}
              >
                <Pencil className="mr-1 h-4 w-4" /> {editing ? "Cancelar edição" : "Editar JSON"}
              </Button>
            </>
          )}
        </div>
      </Card>

      {!registry ? (
        <Card className="p-10 text-center text-muted-foreground">
          Importe um arquivo recebimento.json para visualizar, editar e exportar.
        </Card>
      ) : editing ? (
        <Card className="p-4 shadow-soft">
          <Label className="mb-2">Editar conteúdo JSON</Label>
          <Textarea
            className="min-h-[400px] font-mono text-xs"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit}>Salvar alterações</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-4 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <p className="font-semibold">
                Recebimento — {payment?.date ? formatDateBR(payment.date) : "sem data"}
              </p>
              <p className="text-sm text-muted-foreground">
                {payment?.tripIds?.length ?? 0} viagem(ns) ·{" "}
                {payment?.receivedValue != null
                  ? `Recebido: ${formatBRL(Number(payment.receivedValue))}`
                  : ""}
                {payment?.expectedValue != null
                  ? ` · Esperado: ${formatBRL(Number(payment.expectedValue))}`
                  : ""}
              </p>
            </div>
          </div>
          <pre className="max-h-[500px] overflow-auto rounded-lg border border-border bg-secondary/30 p-4 text-xs">
            {JSON.stringify(registry, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}