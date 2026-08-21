import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useExpenses,
  useTrucks,
  useDrivers,
  usePayments,
  useSettings,
  uid,
  formatBRL,
  formatDateBR,
  toBrasiliaISO,
  toBrasiliaInput,
  type Expense,
  type ExpenseResponsibility,
  type Attachment,
} from "@/lib/storage";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  Calendar,
  Truck as TruckIcon,
  FileDown,
  X,
  Wrench,
  User as UserIcon,
  Lock,
  Code as Code2,
} from "lucide-react";
import { toast } from "sonner";
import { AttachmentsField, AttachmentsList } from "@/components/Attachments";
import { Pagination, PAGE_SIZE } from "@/components/Pagination";
import { JsonEditorDialog } from "@/components/JsonEditorDialog";
import { TruckNav, type TruckNavItem } from "@/components/TruckNav";
import {
  buildPdfDoc,
  previewPdf,
  pdfKpiRow,
  pdfSectionTitle,
  pdfTableLayout,
  PDF_COLORS,
  th,
} from "@/lib/pdf-theme";

export { ExpensesPage as MaintenanceSection };

const RESP_LABEL: Record<ExpenseResponsibility, string> = {
  minha: "Minha despesa",
  desconto: "Frigorífico desconta",
  ressarcir: "Frigorífico ressarce",
};

function ExpensesPage() {
  const [expenses, setExpenses] = useExpenses();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();
  const [payments] = usePayments();
  const lockedIds = useMemo(() => new Set(payments.flatMap((p) => p.expenseIds)), [payments]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [settings] = useSettings();
  const [jsonEditItem, setJsonEditItem] = useState<Expense | null>(null);
  const [jsonEditOpen, setJsonEditOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [driverFilter, setDriverFilter] = useState<string>("__all__");
  const [truckFilter, setTruckFilter] = useState<string>("__all__");
  const [statusFilter, setStatusFilter] = useState<"__all__" | "aberto" | "pago">("__all__");
  const [page, setPage] = useState(1);

  const filtered = useMemo(
    () =>
      expenses.filter((e) => {
        const d = e.date.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        if (driverFilter === "__none__" && e.driverId) return false;
        if (
          driverFilter !== "__all__" &&
          driverFilter !== "__none__" &&
          e.driverId !== driverFilter
        )
          return false;
        if (truckFilter !== "__all__" && e.truckId !== truckFilter) return false;
        if (statusFilter === "aberto" && lockedIds.has(e.id)) return false;
        if (statusFilter === "pago" && !lockedIds.has(e.id)) return false;
        return true;
      }),
    [expenses, dateFrom, dateTo, driverFilter, truckFilter, statusFilter, lockedIds],
  );

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => b.date.localeCompare(a.date)),
    [filtered],
  );
  const totalValue = useMemo(() => sorted.reduce((s, e) => s + e.value, 0), [sorted]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [sorted, safePage],
  );
  useMemo(() => {
    setPage(1);
  }, [dateFrom, dateTo, driverFilter, truckFilter, statusFilter]);

  const navItems = useMemo<TruckNavItem[]>(() => {
    const items: TruckNavItem[] = [
      {
        key: "__all__",
        label: "Todas as manutenções",
        desc: "Ver todos os registros",
        icon: Wrench,
        count: expenses.length,
      },
    ];
    for (const tr of trucks) {
      items.push({
        key: tr.id,
        label: tr.name,
        desc: tr.plate,
        icon: TruckIcon,
        count: expenses.filter((e) => e.truckId === tr.id).length,
      });
    }
    return items;
  }, [trucks, expenses]);

  const remove = (id: string) => {
    if (lockedIds.has(id)) {
      toast.error("Despesa está em um recebimento. Exclua o recebimento antes.");
      return;
    }
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    toast.success("Despesa removida");
  };

  const generatePDF = async () => {
    if (filtered.length === 0) {
      toast.error("Nenhuma despesa no período.");
      return;
    }
    try {
      const grouped = new Map<string, Expense[]>();
      for (const e of filtered) {
        const arr = grouped.get(e.truckId) ?? [];
        arr.push(e);
        grouped.set(e.truckId, arr);
      }

      const periodo =
        dateFrom || dateTo
          ? `Período: ${dateFrom ? new Date(dateFrom + "T00:00").toLocaleDateString("pt-BR") : "início"} até ${dateTo ? new Date(dateTo + "T00:00").toLocaleDateString("pt-BR") : "hoje"}`
          : "Período: todas as despesas";

      const grandTotal = filtered.reduce((s, e) => s + e.value, 0);
      const grandMinha = filtered
        .filter((e) => e.responsibility === "minha")
        .reduce((s, e) => s + e.value, 0);

      const content: unknown[] = [
        pdfKpiRow([
          { label: "Registros", value: String(filtered.length) },
          { label: "Minhas despesas", value: formatBRL(grandMinha), color: PDF_COLORS.danger },
          { label: "Total", value: formatBRL(grandTotal), color: PDF_COLORS.primaryDark },
        ]),
        { text: periodo, style: "subtle", margin: [0, 0, 0, 8] },
      ];

      const truckIds = Array.from(grouped.keys());
      truckIds.forEach((truckId, idx) => {
        const list = grouped.get(truckId)!;
        const truck = trucks.find((x) => x.id === truckId);
        const ordered = [...list].sort((a, b) => a.date.localeCompare(b.date));
        const subtotal = ordered.reduce((s, e) => s + e.value, 0);
        const label = `${truck?.name ?? "Caminhão removido"} — ${truck?.plate ?? "—"}`;
        content.push({ ...pdfSectionTitle(label), ...(idx > 0 ? { pageBreak: "before" } : {}) });

        const rows: unknown[] = [
          [
            th("Data"),
            th("Categoria"),
            th("Descrição"),
            th("Motorista"),
            th("Responsável"),
            th("Valor"),
          ],
        ];
        for (const e of ordered) {
          const driver = drivers.find((d) => d.id === e.driverId);
          rows.push([
            formatDateBR(e.date),
            e.category,
            e.description,
            driver?.name ?? "-",
            RESP_LABEL[e.responsibility],
            formatBRL(e.value),
          ]);
        }
        rows.push([
          {
            text: `Subtotal (${ordered.length})`,
            colSpan: 5,
            alignment: "right",
            bold: true,
            color: PDF_COLORS.primaryDark,
          },
          {},
          {},
          {},
          {},
          { text: formatBRL(subtotal), bold: true, color: PDF_COLORS.primaryDark },
        ]);

        content.push({
          table: {
            headerRows: 1,
            widths: ["auto", "auto", "*", "auto", "auto", "auto"],
            body: rows,
          },
          layout: pdfTableLayout,
          fontSize: 9,
        });
      });

      content.push({
        text: `Total geral: ${formatBRL(grandTotal)}  •  Minhas despesas: ${formatBRL(grandMinha)}`,
        style: "total",
        margin: [0, 16, 0, 0],
      });

      const docDefinition = buildPdfDoc({
        title: "Relatório de Manutenção",
        subtitle: periodo,
        content,
      });

      await previewPdf(
        docDefinition,
        `relatorio-despesas-${new Date().toISOString().slice(0, 10)}.pdf`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold">Manutenção</h2>
          <p className="text-muted-foreground">
            Borracharia, elétrica, mecânica e outros serviços.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" onClick={generatePDF}>
            <FileDown className="mr-1 h-4 w-4" /> Gerar PDF
          </Button>
          <Dialog
            open={open}
            onOpenChange={(v) => {
              setOpen(v);
              if (!v) setEditing(null);
            }}
          >
            <DialogTrigger asChild>
              <Button size="lg" onClick={() => setEditing(null)}>
                <Plus className="mr-1 h-4 w-4" /> Nova despesa
              </Button>
            </DialogTrigger>
            <ExpenseDialog
              key={editing?.id ?? "new"}
              expense={editing}
              onSaved={() => {
                setOpen(false);
                setEditing(null);
              }}
            />
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <TruckNav items={navItems} value={truckFilter} onChange={setTruckFilter} />
        <div className="space-y-6">
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
                <Label className="text-xs">Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos</SelectItem>
                    <SelectItem value="aberto">Em aberto</SelectItem>
                    <SelectItem value="pago">Recebidos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(dateFrom ||
                dateTo ||
                driverFilter !== "__all__" ||
                truckFilter !== "__all__" ||
                statusFilter !== "__all__") && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                    setDriverFilter("__all__");
                    setTruckFilter("__all__");
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

          {trucks.length === 0 && (
            <Card className="p-6 shadow-soft">
              <p className="text-sm">
                Cadastre ao menos um{" "}
                <Link to="/cadastros" className="text-primary underline">
                  caminhão
                </Link>{" "}
                antes de lançar despesas.
              </p>
            </Card>
          )}

          {sorted.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              Nenhuma despesa registrada.
            </Card>
          ) : (
            <div className="space-y-3">
              {paged.map((e) => {
                const truck = trucks.find((x) => x.id === e.truckId);
                const driver = drivers.find((x) => x.id === e.driverId);
                const locked = lockedIds.has(e.id);
                return (
                  <Card key={e.id} className="p-5 shadow-soft">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant={
                              e.responsibility === "minha"
                                ? "destructive"
                                : e.responsibility === "ressarcir"
                                  ? "default"
                                  : "secondary"
                            }
                          >
                            {RESP_LABEL[e.responsibility]}
                          </Badge>
                          {locked && (
                            <Badge variant="outline" className="border-amber-500 text-amber-600">
                              <Lock className="mr-1 h-3 w-3" /> Em recebimento
                            </Badge>
                          )}
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDateBR(e.date)}
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
                        <p className="flex items-center gap-2 text-base font-semibold">
                          <Wrench className="h-4 w-4 text-accent" />
                          {e.category}
                          {e.description ? (
                            <span className="text-muted-foreground"> — {e.description}</span>
                          ) : null}
                        </p>
                        {e.notes && (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {e.notes}
                          </p>
                        )}
                        <AttachmentsList items={e.attachments} />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Valor
                          </p>
                          <p className="text-2xl font-bold text-primary">{formatBRL(e.value)}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={locked}
                          onClick={() => {
                            setEditing(e);
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
                              setJsonEditItem(e);
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
                          onClick={() => remove(e.id)}
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
        </div>
      </div>

      <JsonEditorDialog
        open={jsonEditOpen}
        onOpenChange={setJsonEditOpen}
        title={`Editar manutenção — ${jsonEditItem?.date ?? ""}`}
        data={jsonEditItem}
        onSave={(updated) => {
          if (jsonEditItem && updated && typeof updated === "object") {
            setExpenses((prev) =>
              prev.map((e) => (e.id === jsonEditItem.id ? ({ ...e, ...updated } as Expense) : e)),
            );
          }
        }}
      />
    </div>
  );
}

function ExpenseDialog({ expense, onSaved }: { expense: Expense | null; onSaved: () => void }) {
  const [, setExpenses] = useExpenses();
  const [trucks] = useTrucks();
  const [drivers] = useDrivers();

  const availableDrivers = useMemo(
    () => drivers.filter((d) => d.active || d.id === expense?.driverId),
    [drivers, expense?.driverId],
  );

  const [date, setDate] = useState(toBrasiliaInput(expense?.date));
  const [truckId, setTruckId] = useState(expense?.truckId ?? trucks[0]?.id ?? "");
  const [driverId, setDriverId] = useState(expense?.driverId ?? "");
  const [category, setCategory] = useState(expense?.category ?? "Mecânica");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [value, setValue] = useState(expense ? String(expense.value) : "");
  const [responsibility, setResponsibility] = useState<ExpenseResponsibility>(
    expense?.responsibility ?? "minha",
  );
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [attachments, setAttachments] = useState<Attachment[]>(expense?.attachments ?? []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!truckId) {
      toast.error("Selecione o caminhão.");
      return;
    }
    if (!category.trim()) {
      toast.error("Informe a categoria.");
      return;
    }
    const v = Number(value);
    if (!v || v <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    const next: Expense = {
      id: expense?.id ?? uid(),
      date: toBrasiliaISO(date),
      truckId,
      driverId: driverId || undefined,
      category: category.trim(),
      description: description.trim(),
      value: v,
      responsibility,
      notes: notes.trim() || undefined,
      attachments,
    };
    setExpenses((prev) =>
      expense ? prev.map((p) => (p.id === expense.id ? next : p)) : [...prev, next],
    );
    toast.success(expense ? "Despesa atualizada" : `Despesa registrada — ${formatBRL(v)}`);
    onSaved();
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{expense ? "Editar despesa" : "Nova despesa"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label>Data e hora</Label>
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <Label>Caminhão</Label>
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
        <div>
          <Label>Categoria</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Borracharia">Borracharia</SelectItem>
              <SelectItem value="Elétrica">Elétrica</SelectItem>
              <SelectItem value="Mecânica">Mecânica</SelectItem>
              <SelectItem value="Lavagem">Lavagem</SelectItem>
              <SelectItem value="Peças">Peças</SelectItem>
              <SelectItem value="Outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label>Descrição</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ex: troca de pneu traseiro esquerdo"
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
        <div className="sm:col-span-2">
          <Label>Responsável pelo pagamento</Label>
          <RadioGroup
            value={responsibility}
            onValueChange={(v) => setResponsibility(v as ExpenseResponsibility)}
            className="mt-2 flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem id="r-minha" value="minha" />
              <Label htmlFor="r-minha" className="cursor-pointer font-normal">
                Minha despesa
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="r-desc" value="desconto" />
              <Label htmlFor="r-desc" className="cursor-pointer font-normal">
                Frigorífico desconta no pagamento
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem id="r-ress" value="ressarcir" />
              <Label htmlFor="r-ress" className="cursor-pointer font-normal">
                Frigorífico ressarce
              </Label>
            </div>
          </RadioGroup>
        </div>
        <div className="sm:col-span-2">
          <Label>Observações (opcional)</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Detalhes adicionais sobre o serviço..."
          />
        </div>

        <div className="sm:col-span-2">
          <AttachmentsField
            value={attachments}
            onChange={setAttachments}
            label="Anexos (NF, recibo, fotos...)"
          />
        </div>

        <DialogFooter className="sm:col-span-2">
          <Button type="submit" size="lg">
            {expense ? "Salvar alterações" : "Salvar despesa"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
