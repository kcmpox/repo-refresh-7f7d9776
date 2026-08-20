// Helper compartilhado para gerar PDFs com jsPDF + autotable.
// Design inspirado em planilhas limpas: fundo branco, bordas finas,
// texto preto, mínimo de tinta. Apenas destaques pontuais de cor.

import { jsPDF } from "jspdf";
import autoTable, { type CellDef, type RowInput } from "jspdf-autotable";

export const PDF_COLORS = {
  primary: "#000000",
  primaryDark: "#000000",
  primaryLight: "#f0f0f0",
  accent: "#660000",
  danger: "#660000",
  success: "#006600",
  ink: "#000000",
  muted: "#666666",
  border: "#cccccc",
  soft: "#f9f9f9",
  white: "#ffffff",
};

export type PdfKpi = { label: string; value: string; color?: string };

type KpiMarker = { __kpi: true; items: PdfKpi[]; pageBreak?: "before" };
type SectionMarker = {
  __section: true;
  title: string;
  color: string;
  pageBreak?: "before";
};
type TableCellObj = {
  text?: string | number;
  content?: string | number;
  bold?: boolean;
  italics?: boolean;
  color?: string;
  fillColor?: string;
  alignment?: "left" | "center" | "right";
  colSpan?: number;
  rowSpan?: number;
  fontSize?: number;
};
type TableCell = string | number | TableCellObj | Record<string, never>;
type TableItem = {
  table: {
    headerRows?: number;
    widths?: (string | number)[];
    body: TableCell[][];
  };
  layout?: unknown;
  fontSize?: number;
  pageBreak?: "before";
};
type TextItem = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  color?: string;
  alignment?: "left" | "center" | "right";
  fontSize?: number;
  margin?: [number, number, number, number] | number[];
  style?: "subtle" | "truckHeader" | "total" | string;
  pageBreak?: "before";
};
export type ContentItem = KpiMarker | SectionMarker | TableItem | TextItem;

export interface DocDefinition {
  title: string;
  subtitle: string;
  content: ContentItem[];
  orientation: "portrait" | "landscape";
}

export function pdfKpiRow(items: PdfKpi[]): KpiMarker {
  return { __kpi: true, items };
}

export function pdfSectionTitle(
  title: string,
  color = PDF_COLORS.primary,
): SectionMarker {
  return { __section: true, title, color };
}

export const pdfTableLayout = { boiada: true } as const;

export function th(text: string): TableCellObj {
  return { text, bold: true, color: PDF_COLORS.ink, fontSize: 9 };
}

export function buildPdfDoc(opts: {
  title: string;
  subtitle: string;
  content: unknown[];
  orientation?: "portrait" | "landscape";
}): DocDefinition {
  return {
    title: opts.title,
    subtitle: opts.subtitle,
    content: opts.content as ContentItem[],
    orientation: opts.orientation ?? "portrait",
  };
}

// ---------- Renderer ----------

const MARGIN_X = 28;
const MARGIN_TOP = 24;
const MARGIN_BOTTOM = 32;

function drawHeader(
  doc: jsPDF,
  title: string,
  subtitle: string,
  pageWidth: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(PDF_COLORS.ink);
  doc.text(title, MARGIN_X, 28);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(PDF_COLORS.muted);
  doc.text(subtitle, MARGIN_X, 42);

  doc.setDrawColor(PDF_COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_X, 48, pageWidth - MARGIN_X, 48);

  return 60;
}

function drawKpiRow(
  doc: jsPDF,
  items: PdfKpi[],
  x: number,
  y: number,
  width: number,
): number {
  if (items.length === 0) return y;
  const gap = 6;
  const w = (width - gap * (items.length - 1)) / items.length;
  const h = 36;
  items.forEach((it, i) => {
    const cx = x + i * (w + gap);
    doc.setDrawColor(PDF_COLORS.border);
    doc.setLineWidth(0.4);
    doc.rect(cx, y, w, h, "S");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.muted);
    doc.text(it.label.toUpperCase(), cx + 6, y + 12);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(it.color ?? PDF_COLORS.ink);
    doc.text(it.value, cx + 6, y + 28);
  });
  return y + h + 8;
}

function drawSection(
  doc: jsPDF,
  title: string,
  _color: string,
  x: number,
  y: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(PDF_COLORS.ink);
  doc.text(title, x, y + 8);
  doc.setDrawColor(PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(x, y + 12, x + 200, y + 12);
  return y + 16;
}

function drawText(
  doc: jsPDF,
  item: TextItem,
  x: number,
  y: number,
  width: number,
): number {
  const margin = item.margin ?? [0, 0, 0, 0];
  const styleMap: Record<string, Partial<TextItem>> = {
    subtle: { color: PDF_COLORS.muted, fontSize: 9 },
    truckHeader: { fontSize: 12, bold: true, color: PDF_COLORS.primaryDark },
    total: {
      fontSize: 12,
      bold: true,
      alignment: "right",
      color: PDF_COLORS.primaryDark,
    },
  };
  const styled = item.style ? styleMap[item.style] ?? {} : {};
  const bold = item.bold ?? styled.bold ?? false;
  const italics = item.italics ?? styled.italics ?? false;
  const color = item.color ?? styled.color ?? PDF_COLORS.ink;
  const size = item.fontSize ?? styled.fontSize ?? 10;
  const alignment = item.alignment ?? styled.alignment ?? "left";
  const topM = Number(margin[1] ?? margin[0] ?? 0);
  const bottomM = Number(margin[3] ?? margin[2] ?? 0);
  doc.setFont(
    "helvetica",
    bold && italics ? "bolditalic" : bold ? "bold" : italics ? "italic" : "normal",
  );
  doc.setFontSize(size);
  doc.setTextColor(color);
  const startY = y + topM + size;
  const wrapWidth = width;
  const lines = doc.splitTextToSize(item.text, wrapWidth) as string[];
  const opts: Parameters<jsPDF["text"]>[3] =
    alignment === "right"
      ? { align: "right" }
      : alignment === "center"
        ? { align: "center" }
        : undefined;
  const drawX = alignment === "right" ? x + width : alignment === "center" ? x + width / 2 : x;
  doc.text(lines, drawX, startY, opts);
  return startY + (lines.length - 1) * (size + 2) + bottomM + 4;
}

function cellToDef(c: TableCell): CellDef {
  if (c == null) return { content: "" };
  if (typeof c === "string" || typeof c === "number") return { content: String(c) };
  if (typeof c === "object" && !("text" in c) && !("content" in c)) return { content: "" };
  const obj = c as TableCellObj;
  const value = obj.text ?? obj.content ?? "";
  const styles: CellDef["styles"] = {};
  if (obj.bold && obj.italics) styles.fontStyle = "bolditalic";
  else if (obj.bold) styles.fontStyle = "bold";
  else if (obj.italics) styles.fontStyle = "italic";
  if (obj.color) styles.textColor = obj.color;
  if (obj.fillColor) styles.fillColor = obj.fillColor;
  if (obj.alignment) styles.halign = obj.alignment;
  if (obj.fontSize) styles.fontSize = obj.fontSize;
  return {
    content: String(value),
    colSpan: obj.colSpan,
    rowSpan: obj.rowSpan,
    styles: Object.keys(styles).length ? styles : undefined,
  };
}

function drawTable(
  doc: jsPDF,
  item: TableItem,
  x: number,
  y: number,
  width: number,
): number {
  const body = item.table.body;
  const headerRows = item.table.headerRows ?? 0;
  const head: RowInput[] = [];
  const rows: RowInput[] = [];
  body.forEach((row, i) => {
    const converted = row.map(cellToDef);
    if (i < headerRows) head.push(converted);
    else rows.push(converted);
  });

  const columnStyles: Record<number, { cellWidth?: number | "auto" | "wrap" }> = {};
  if (item.table.widths) {
    item.table.widths.forEach((w, i) => {
      if (typeof w === "number") columnStyles[i] = { cellWidth: w };
      else if (w === "auto") columnStyles[i] = { cellWidth: "wrap" };
    });
  }

  autoTable(doc, {
    head: head.length ? head : undefined,
    body: rows,
    startY: y,
    margin: { left: x, right: MARGIN_X },
    tableWidth: width,
    styles: {
      fontSize: item.fontSize ?? 9,
      cellPadding: 4,
      textColor: PDF_COLORS.ink,
      lineColor: PDF_COLORS.border,
      lineWidth: 0.2,
      fillColor: PDF_COLORS.white,
    },
    headStyles: {
      fillColor: PDF_COLORS.white,
      textColor: PDF_COLORS.ink,
      fontStyle: "bold",
      fontSize: 9,
      lineColor: PDF_COLORS.ink,
      lineWidth: 0.4,
    },
    alternateRowStyles: { fillColor: PDF_COLORS.soft },
    columnStyles,
  });
  // @ts-expect-error - jspdf-autotable augments lastAutoTable at runtime
  const finalY = (doc.lastAutoTable?.finalY as number | undefined) ?? y;
  return finalY + 6;
}

function isKpi(i: ContentItem): i is KpiMarker {
  return (i as KpiMarker).__kpi === true;
}
function isSection(i: ContentItem): i is SectionMarker {
  return (i as SectionMarker).__section === true;
}
function isTable(i: ContentItem): i is TableItem {
  return typeof (i as TableItem).table === "object" && (i as TableItem).table != null;
}

export async function previewPdf(def: DocDefinition, filename: string) {
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    orientation: def.orientation,
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN_X * 2;

  let y = drawHeader(doc, def.title, def.subtitle, pageWidth);

  const ensureRoom = (needed: number) => {
    if (y + needed > pageHeight - MARGIN_BOTTOM) {
      doc.addPage();
      y = MARGIN_TOP;
    }
  };

  for (const item of def.content) {
    if ((item as { pageBreak?: string }).pageBreak === "before") {
      doc.addPage();
      y = MARGIN_TOP;
    }

    if (isKpi(item)) {
      ensureRoom(50);
      y = drawKpiRow(doc, item.items, MARGIN_X, y, contentWidth);
    } else if (isSection(item)) {
      ensureRoom(20);
      y = drawSection(doc, item.title, item.color, MARGIN_X, y);
    } else if (isTable(item)) {
      ensureRoom(40);
      y = drawTable(doc, item, MARGIN_X, y, contentWidth);
    } else if ("text" in item) {
      ensureRoom(24);
      y = drawText(doc, item as TextItem, MARGIN_X, y, contentWidth);
    }
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.muted);
    doc.text(
      "Boiada • Relatório gerado automaticamente",
      MARGIN_X,
      pageHeight - 12,
    );
    doc.text(
      `Página ${i} de ${total}`,
      pageWidth - MARGIN_X,
      pageHeight - 12,
      { align: "right" },
    );
  }

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  const { requestPdfPreview } = await import("@/components/PdfPreviewDialog");
  requestPdfPreview(url, filename);
}
