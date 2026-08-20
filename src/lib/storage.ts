import { useEffect, useState, useCallback, useMemo } from "react";

export type CattleType = "magro" | "gordo";

export type Destination = "cassilandia" | "bataguassu";

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  path?: string;
  dataUrl?: string;
}

export interface Truck {
  id: string;
  plate: string;
  name: string;
}

export interface Driver {
  id: string;
  name: string;
  phone?: string;
  active: boolean;
}

// --- Price tables ---

/** A single tier in a price table. For "gordo" cattle, tiers define flat
 *  values per km band. For "magro" cattle, the value is entered manually
 *  (no tiers needed). */
export interface PriceTier {
  id: string;
  fromKm: number;
  toKm: number;
  value: number;
}

/** From a certain km onward, the trip value = perKmValue * km.
 *  If null/undefined, the last tier's toKm is the ceiling. */
export interface PerKmConfig {
  enabled: boolean;
  fromKm: number;
  perKmValue: number;
}

/** A named price table version. The "ATUAL" table is the active one.
 *  When the user updates values, the old ATUAL becomes a named archive
 *  (e.g. "CAS_20260718") and a new ATUAL is created. */
export interface PriceTable {
  id: string;
  destination: Destination;
  name: string; // "ATUAL" for active, or archive name like "CAS_20260718"
  tiers: PriceTier[];
  perKm: PerKmConfig;
  createdAt: string; // ISO
}

export interface Trip {
  id: string;
  date: string;
  truckId: string;
  driverId?: string;
  origin: string;
  destination: Destination;
  pecuarista?: string;
  cattleType: CattleType;
  cte?: string;
  minuta?: string;
  kmStart: number;
  kmEnd: number;
  manualDistance?: number;
  lostAnimals: number;
  lostAnimalValue: number;
  /** ID of the price table used as reference (snapshot). */
  priceTableId?: string;
  /** Name of the price table at time of trip creation (for display). */
  priceTableName?: string;
  /** For "magro": value entered manually. For "gordo": calculated from table. */
  manualValue?: number;
  tableValue: number;
  finalValue: number;
  attachments?: Attachment[];
  /** ISO timestamp when driver departed for the trip. */
  departureTime?: string;
  /** ISO timestamp when driver arrived at the frigorífico. */
  arrivalTime?: string;
  /** Whether lost animals have been registered in the dedicated workflow. */
  lostAnimalsConfirmed?: boolean;
  /** When true, the trip is excluded from departure/arrival and history tracking. */
  skipTracking?: boolean;
  /** When true, the trip is archived: hidden from recebimentos, relatórios e demais telas. */
  archived?: boolean;
}

export interface FuelingItem {
  kind: "combustivel" | "outro";
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  /** Responsabilidade específica do item. Sem valor, usa a do registro. */
  responsibility?: ExpenseResponsibility;
}

export interface Fueling {
  id: string;
  date: string;
  truckId: string;
  driverId?: string;
  odometer: number;
  items: FuelingItem[];
  deductFromPayment: boolean;
  responsibility?: ExpenseResponsibility;
  generalDiscount?: number;
  nfe?: string;
  attachments?: Attachment[];
}

export type ExpenseResponsibility = "minha" | "desconto" | "ressarcir";

export interface Expense {
  id: string;
  date: string;
  truckId: string;
  driverId?: string;
  category: string;
  description: string;
  value: number;
  responsibility: ExpenseResponsibility;
  notes?: string;
  attachments?: Attachment[];
}

export interface Toll {
  id: string;
  dateTime: string;
  tollName: string;
  tollLocationId?: string;
  truckId?: string;
  driverId?: string;
  tripId?: string;
  value: number;
  semParar: boolean;
  responsibility: ExpenseResponsibility;
  notes?: string;
  attachments?: Attachment[];
}

export type CardinalDirection = "N" | "S" | "L" | "O" | "N/S" | "L/O";

export interface TollLocation {
  id: string;
  name: string;
  highway: string;
  km: string;
  city: string;
  direction: CardinalDirection;
  latitude?: number;
  longitude?: number;
}

export const RENT_PERCENT = 0.1;

export interface Payment {
  id: string;
  date: string;
  tripIds: string[];
  fuelingIds: string[];
  expenseIds: string[];
  tollIds: string[];
  rentPercent: number;
  grossValue: number;
  rentValue: number;
  reimbursedValue: number;
  deductedValue: number;
  expectedValue: number;
  receivedValue: number;
  /** Per-trip received values (for tracking individual payments). */
  tripReceivedValues?: Record<string, number>;
  notes?: string;
}

export interface PaymentAdjustment {
  id: string;
  paymentId: string;
  tripId?: string;
  type: "desconto" | "ressarcimento" | "bonus" | "correcao";
  amount: number;
  note: string;
  createdAt: string;
  bonusId?: string;
  status: "aberto" | "cobrado" | "aceito" | "recebido";
}

export interface PricingBonus {
  id: string;
  monthYYYYMM: string;
  percent: number;
  note: string;
  createdAt: string;
}

// --- Driver payments / vales / ajuda de custo ---

export type DriverEntryType =
  "comissao" | "vale" | "ajuda_custo" | "pagamento" | "desconto" | "bonus";

export interface DriverEntry {
  id: string;
  driverId: string;
  date: string; // ISO YYYY-MM-DD
  type: DriverEntryType;
  amount: number;
  description?: string;
  createdAt: string;
}

// --- Commission payments (period-based) ---

export interface CommissionPayment {
  id: string;
  driverId: string;
  date: string; // payment date YYYY-MM-DD
  periodStart: string; // start date of the period (last payment's periodEnd or "")
  periodEnd: string; // end date of the period (trips up to this date are included)
  /** Trips included in this payment period */
  tripIds: string[];
  /** Driver entries (vales, bonus, descontos, etc.) consumed by this payment */
  entryIds?: string[];
  /** 10% of trip values minus losses */
  commissionValue: number;
  /** Manual commissions in this period */
  manualCommissionsTotal: number;
  /** Bonuses in this period */
  bonusTotal: number;
  /** Discounts in this period */
  descontosTotal: number;
  /** Vales taken since last payment */
  valesTotal: number;
  /** Vale amount being deducted in this payment */
  valeDeducted: number;
  /** Ajuda de custo accumulated in this period */
  ajudaCusto: number;
  /** Remaining vale balance carried forward */
  remainingVales: number;
  /** Vales carried from previous period (remaining + excess) */
  previousCarriedVales: number;
  /** Shortfall from previous period (system owed driver) */
  previousShortfall: number;
  /** What the driver was owed this period */
  balanceDue: number;
  /** Excess payment carried as vale to next period */
  excessAsVale: number;
  /** Underpayment carried forward (system owes driver) */
  shortfall: number;
  /** Final amount paid */
  paidAmount: number;
  /** Whether payment is finalized */
  finalized: boolean;
  createdAt: string;
}

// --- App settings ---

export interface AppSettings {
  ajudaCustoMax: number;
  editorMode?: boolean;
  paymentSound?: string; // data URL of custom sound
  receiptSound?: string; // data URL of custom sound
}

const DEFAULT_SETTINGS: AppSettings = {
  ajudaCustoMax: 1500,
  editorMode: false,
};

const KEYS = {
  trucks: "gt_trucks",
  drivers: "gt_drivers",
  priceTables: "gt_price_tables",
  // Legacy key — kept for migration
  legacyTiers: "gt_price_tiers",
  trips: "gt_trips",
  fuelings: "gt_fuelings",
  expenses: "gt_expenses",
  tolls: "gt_tolls",
  tollLocations: "gt_toll_locations",
  payments: "gt_payments",
  adjustments: "gt_payment_adjustments",
  bonuses: "gt_pricing_bonuses",
  driverEntries: "gt_driver_entries",
  commissionPayments: "gt_commission_payments",
  settings: "gt_settings",
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("gt-storage", { detail: { key } }));
}

function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    setValue(read(key, fallback));
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ key: string }>;
      if (ev.detail?.key === key) setValue(read(key, fallback));
    };
    window.addEventListener("gt-storage", handler);
    window.addEventListener("storage", () => setValue(read(key, fallback)));
    return () => window.removeEventListener("gt-storage", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (updater: T | ((prev: T) => T)) => {
      const current = read<T>(key, fallback);
      const next = typeof updater === "function" ? (updater as (p: T) => T)(current) : updater;
      write(key, next);
      setValue(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, update] as const;
}

export const useTrucks = () => useStored<Truck[]>(KEYS.trucks, []);
export const useDrivers = () => useStored<Driver[]>(KEYS.drivers, []);
export const usePriceTables = () => useStored<PriceTable[]>(KEYS.priceTables, []);
export const useTrips = () => useStored<Trip[]>(KEYS.trips, []);
/** Trips excluding archived ones. The setter still operates on the full list. */
export const useActiveTrips = () => {
  const [trips, setTrips] = useTrips();
  const activeTrips = useMemo(() => trips.filter((t) => !t.archived), [trips]);
  return [activeTrips, setTrips] as const;
};
export const useFuelings = () => useStored<Fueling[]>(KEYS.fuelings, []);
export const useExpenses = () => useStored<Expense[]>(KEYS.expenses, []);
export const useTolls = () => useStored<Toll[]>(KEYS.tolls, []);
export const useTollLocations = () => useStored<TollLocation[]>(KEYS.tollLocations, []);
export const usePayments = () => useStored<Payment[]>(KEYS.payments, []);
export const useAdjustments = () => useStored<PaymentAdjustment[]>(KEYS.adjustments, []);
export const useBonuses = () => useStored<PricingBonus[]>(KEYS.bonuses, []);
export const useDriverEntries = () => useStored<DriverEntry[]>(KEYS.driverEntries, []);
export const useCommissionPayments = () =>
  useStored<CommissionPayment[]>(KEYS.commissionPayments, []);
export const useSettings = () => useStored<AppSettings>(KEYS.settings, DEFAULT_SETTINGS);

// --- Legacy hooks for backward compat (configuracoes import) ---
export const usePriceTiers = () => useStored<OldPriceTier[]>(KEYS.legacyTiers, []);

// Legacy type for migration
export interface OldPriceTier {
  id: string;
  cattleType: CattleType;
  fromKm: number;
  toKm: number;
  value: number;
}

// --- Migration ---

export function migrateLegacyData() {
  if (typeof window === "undefined") return;
  const migrated = localStorage.getItem("gt_migrated_v2");
  if (migrated) return;

  const legacyTiers = read<OldPriceTier[]>(KEYS.legacyTiers, []);
  const existingTables = read<PriceTable[]>(KEYS.priceTables, []);

  const now = new Date().toISOString();
  let tables = read<PriceTable[]>(KEYS.priceTables, []);

  if (legacyTiers.length > 0 && tables.length === 0) {
    const gordoTiers = legacyTiers.filter((t) => t.cattleType === "gordo");
    tables = [];

    if (gordoTiers.length > 0) {
      tables.push({
        id: uid(),
        destination: "bataguassu",
        name: "ATUAL",
        tiers: gordoTiers.map((t) => ({
          id: t.id,
          fromKm: t.fromKm,
          toKm: t.toKm,
          value: t.value,
        })),
        perKm: { enabled: false, fromKm: 0, perKmValue: 0 },
        createdAt: now,
      });
    }
  }

  // Ensure both destinations have an ATUAL table
  const destinations: Destination[] = ["bataguassu", "cassilandia"];
  let changed = false;
  for (const dest of destinations) {
    const has = tables.some((t) => t.destination === dest && t.name === "ATUAL");
    if (!has) {
      tables.push({
        id: uid(),
        destination: dest,
        name: "ATUAL",
        tiers: [],
        perKm: { enabled: false, fromKm: 0, perKmValue: 0 },
        createdAt: now,
      });
      changed = true;
    }
  }
  if (changed || legacyTiers.length > 0) {
    write(KEYS.priceTables, tables);
  }

  // Migrate existing trips: add destination and priceTableId
  const trips = read<Trip[]>(KEYS.trips, []);
  if (trips.length > 0 && !trips[0].destination) {
    const tables = read<PriceTable[]>(KEYS.priceTables, []);
    const batAtual = tables.find((t) => t.destination === "bataguassu" && t.name === "ATUAL");
    const migratedTrips = trips.map((t) => ({
      ...t,
      destination: "bataguassu" as Destination,
      priceTableId: batAtual?.id,
      priceTableName: batAtual?.name,
      manualValue: t.cattleType === "magro" ? t.tableValue : undefined,
    }));
    write(KEYS.trips, migratedTrips);
  }

  localStorage.setItem("gt_migrated_v2", "1");
}

// --- Trip value calculation ---

export function calculateTripValue(
  table: PriceTable | undefined,
  cattleType: CattleType,
  km: number,
  manualValue?: number,
): number {
  if (cattleType === "magro") {
    return Math.max(0, Number(manualValue) || 0);
  }
  if (!table) return 0;

  // Check per-km config first
  if (table.perKm.enabled && km >= table.perKm.fromKm) {
    return table.perKm.perKmValue * km;
  }

  // Otherwise find tier
  const tier = table.tiers.find((t) => km >= t.fromKm && km <= t.toKm);
  return tier ? tier.value : 0;
}

export function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Converte um valor de input datetime-local (sem fuso) para ISO em UTC-3 (Brasília).
 * Ex: "2026-07-30T09:10" → "2026-07-30T09:10:00.000-03:00"
 */
export function toBrasiliaISO(localInput: string): string {
  if (!localInput) return "";
  // O input datetime-local já vem sem fuso; anexamos -03:00 diretamente
  // para representar horário de Brasília.
  const normalized = localInput.length === 16 ? localInput + ":00" : localInput;
  return normalized + "-03:00";
}

/**
 * Converte um ISO (possivelmente em UTC-0) para o formato de input datetime-local,
 * mostrando o horário no fuso de Brasília (UTC-3).
 */
export function toBrasiliaInput(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (isNaN(d.getTime())) return "";
  // Converte para o horário de Brasília (UTC-3) manualmente
  const brasilia = new Date(d.getTime() + d.getTimezoneOffset() * 60000 - 3 * 3600000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${brasilia.getFullYear()}-${pad(brasilia.getMonth() + 1)}-${pad(brasilia.getDate())}T${pad(brasilia.getHours())}:${pad(brasilia.getMinutes())}`;
}

/**
 * Hoje no formato YYYY-MM-DD no fuso de Brasília.
 */
export function todayBrasilia(): string {
  return toBrasiliaInput(new Date().toISOString()).slice(0, 10);
}

export function formatBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateBR(s: string) {
  if (!s) return "";
  const ymd = s.slice(0, 10);
  const parts = ymd.split("-");
  if (parts.length !== 3) return s;
  const [y, m, d] = parts;
  return `${d}/${m}/${y}`;
}

export function sumAdjustments(list: PaymentAdjustment[]): number {
  return list.reduce((s, a) => s + a.amount, 0);
}

export function paymentFinalValue(payment: Payment, adjustments: PaymentAdjustment[]): number {
  const mine = adjustments.filter((a) => a.paymentId === payment.id);
  return payment.receivedValue + sumAdjustments(mine);
}

export function paymentDiscrepancy(payment: Payment, adjustments: PaymentAdjustment[]): number {
  return paymentFinalValue(payment, adjustments) - payment.expectedValue;
}

export const DESTINATION_LABELS: Record<Destination, string> = {
  cassilandia: "Cassilândia",
  bataguassu: "Bataguassu",
};

export const DESTINATION_PREFIX: Record<Destination, string> = {
  cassilandia: "CAS",
  bataguassu: "BAT",
};

// --- Driver entry helpers ---

export function driverBalance(entries: DriverEntry[]): number {
  return entries.reduce((s, e) => {
    if (e.type === "pagamento") return s - e.amount;
    return s + e.amount;
  }, 0);
}

// --- Commission helpers ---

export function computeCommissionForTrips(trips: Trip[]): number {
  const gross = trips.reduce((s, t) => s + t.finalValue, 0);
  const lostValue = trips.reduce((s, t) => s + t.lostAnimals * t.lostAnimalValue, 0);
  return Math.max(0, gross * 0.1 - lostValue);
}

/**
 * Caps ajuda de custo at `max` by consuming the oldest entries first.
 * Returns the consumed amount (capped), the excess that carries forward,
 * which entry IDs were fully consumed, and whether one was partially
 * consumed (the partial entry's remaining amount stays open for next period).
 */
export function capAjudaCusto(
  entries: DriverEntry[],
  max: number,
  carriedForward: number = 0,
): {
  consumed: number;
  excess: number;
  consumedEntryIds: string[];
  partialEntry: { id: string; excessAmount: number } | null;
} {
  const ajudaEntries = entries
    .filter((e) => e.type === "ajuda_custo")
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));

  let remaining = Math.max(0, max - carriedForward);
  let consumed = carriedForward;
  let excess = 0;
  const consumedEntryIds: string[] = [];
  let partialEntry: { id: string; excessAmount: number } | null = null;

  for (const entry of ajudaEntries) {
    if (remaining <= 0) {
      excess += entry.amount;
      continue;
    }
    if (entry.amount <= remaining) {
      consumed += entry.amount;
      remaining -= entry.amount;
      consumedEntryIds.push(entry.id);
    } else {
      consumed += remaining;
      excess += entry.amount - remaining;
      partialEntry = { id: entry.id, excessAmount: entry.amount - remaining };
      remaining = 0;
    }
  }

  return { consumed, excess, consumedEntryIds, partialEntry };
}

/**
 * Recalculates all finalized commission payments for a driver, sequentially.
 * Each payment is recomputed based on the trips and entries that fall within
 * its period (periodStart exclusive .. periodEnd inclusive). Carry-over
 * values (remainingVales, excessAsVale, shortfall) are propagated forward.
 *
 * Ajuda de custo is capped at `ajudaCustoMax` per payment: only the oldest
 * entries are consumed until the cap is reached. Excess ajuda de custo is
 * carried forward to the next payment as `carriedAjudaCusto`.
 */
export function recalculateDriverPayments(
  driverId: string,
  payments: CommissionPayment[],
  trips: Trip[],
  entries: DriverEntry[],
  ajudaCustoMax?: number,
): CommissionPayment[] {
  const driverPayments = payments
    .filter((p) => p.driverId === driverId && p.finalized)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (driverPayments.length === 0) return payments;

  const updated = new Map<string, CommissionPayment>();

  let carriedVales = 0;
  let carriedShortfall = 0;
  let carriedAjudaCusto = 0;

  for (const pmt of driverPayments) {
    const periodStart = pmt.periodStart;
    const periodEnd = pmt.periodEnd || pmt.date;

    const periodTrips = trips
      .filter((t) => t.driverId === driverId && t.date > periodStart && t.date <= periodEnd)
      .sort((a, b) => a.date.localeCompare(b.date));

    const periodEntries = pmt.entryIds
      ? entries.filter((e) => pmt.entryIds!.includes(e.id))
      : entries.filter(
          (e) => e.driverId === driverId && e.date > periodStart && e.date <= periodEnd,
        );

    const commission = computeCommissionForTrips(periodTrips);
    const manualCommissionsTotal = periodEntries
      .filter((e) => e.type === "comissao")
      .reduce((s, e) => s + e.amount, 0);
    const valesTotal =
      periodEntries.filter((e) => e.type === "vale").reduce((s, e) => s + e.amount, 0) +
      carriedVales;
    const descontosTotal = periodEntries
      .filter((e) => e.type === "desconto")
      .reduce((s, e) => s + e.amount, 0);
    const bonusTotal = periodEntries
      .filter((e) => e.type === "bonus")
      .reduce((s, e) => s + e.amount, 0);

    // Ajuda de custo capping: consume oldest entries first up to the max
    const max = ajudaCustoMax ?? 0;
    const { consumed, excess: excessAjudaCusto } = capAjudaCusto(
      periodEntries,
      max,
      carriedAjudaCusto,
    );
    const ajudaCusto = consumed;

    const balanceDue =
      commission +
      manualCommissionsTotal +
      bonusTotal -
      (pmt.valeDeducted || 0) -
      descontosTotal +
      carriedShortfall;

    const paidAmount = pmt.paidAmount;
    const excessAsVale = Math.max(0, paidAmount - balanceDue);
    const shortfall = Math.max(0, balanceDue - paidAmount);
    const remainingVales = Math.max(0, valesTotal - (pmt.valeDeducted || 0));

    carriedVales = remainingVales + excessAsVale;
    carriedShortfall = shortfall;
    carriedAjudaCusto = excessAjudaCusto;

    updated.set(pmt.id, {
      ...pmt,
      tripIds: periodTrips.map((t) => t.id),
      commissionValue: commission,
      manualCommissionsTotal,
      bonusTotal,
      descontosTotal,
      valesTotal,
      ajudaCusto,
      balanceDue,
      excessAsVale,
      shortfall,
      remainingVales,
    });
  }

  return payments.map((p) => updated.get(p.id) ?? p);
}
