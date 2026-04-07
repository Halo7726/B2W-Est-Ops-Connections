import { getDb } from "@/lib/db/client";

export type DatePreset = "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

export interface SimpleReportRequest {
  jobNumber: string;
  trackingId: string;
  preset: DatePreset;
  startDate?: string;
  endDate?: string;
}

export interface SimpleReportRow {
  date: string;
  targetQuantity: number;
  trackingId: string;
  jobNumber: string;
}

export interface SimpleReportResult {
  rows: SimpleReportRow[];
  totalQuantity: number;
  dayCount: number;
  startDate: string;
  endDate: string;
}

type CacheRow = {
  data_json: string;
};

export interface SimpleReportOptions {
  jobs: { value: string; label: string }[];
  accounts: { value: string; label: string }[];
}

function parseDateInput(value: string): Date {
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return d;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function resolveDateRange(input: SimpleReportRequest): { startDate: string; endDate: string } {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  if (input.preset === "custom") {
    if (!input.startDate || !input.endDate) {
      throw new Error("Custom range requires startDate and endDate");
    }
    const start = parseDateInput(input.startDate);
    const end = parseDateInput(input.endDate);
    if (start > end) {
      throw new Error("startDate must be before or equal to endDate");
    }
    return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
  }

  if (input.preset === "last7") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6);
    return { startDate: toIsoDate(start), endDate: toIsoDate(today) };
  }

  if (input.preset === "last30") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 29);
    return { startDate: toIsoDate(start), endDate: toIsoDate(today) };
  }

  if (input.preset === "thisMonth") {
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    return { startDate: toIsoDate(start), endDate: toIsoDate(today) };
  }

  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function getSimpleReportOptions(jobNumber?: string): Promise<SimpleReportOptions> {
  const db = await getDb();

  const jobRows = await db.all<CacheRow>(
    "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT 30000",
    ["JobProductionTarget"]
  );

  const jobSet = new Set<string>();
  for (const row of jobRows) {
    const data = JSON.parse(row.data_json) as Record<string, unknown>;
    const job = typeof data.JobNumber === "string" ? data.JobNumber.trim() : "";
    if (job) jobSet.add(job);
  }

  const jobs = Array.from(jobSet)
    .sort((a, b) => a.localeCompare(b))
    .map((j) => ({ value: j, label: j }));

  const accountRows = await db.all<CacheRow>(
    "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT 30000",
    ["JobProductionAccount"]
  );

  const accountMap = new Map<string, string>();

  for (const row of accountRows) {
    const data = JSON.parse(row.data_json) as Record<string, unknown>;
    const rowJob = typeof data.JobNumber === "string" ? data.JobNumber.trim() : "";
    if (jobNumber && rowJob !== jobNumber) continue;

    const trackingId = typeof data.TrackingID === "string" ? data.TrackingID.trim() : "";
    if (!trackingId) continue;

    const desc = typeof data.Description === "string" ? data.Description.trim() : "";
    const uom = typeof data.UnitOfMeasure === "string" ? data.UnitOfMeasure.trim() : "";
    const label = [trackingId, desc, uom ? `(${uom})` : ""].filter(Boolean).join(" - ");

    if (!accountMap.has(trackingId)) {
      accountMap.set(trackingId, label || trackingId);
    }
  }

  if (accountMap.size === 0) {
    for (const row of jobRows) {
      const data = JSON.parse(row.data_json) as Record<string, unknown>;
      const rowJob = typeof data.JobNumber === "string" ? data.JobNumber.trim() : "";
      if (jobNumber && rowJob !== jobNumber) continue;
      const trackingId = typeof data.TrackingID === "string" ? data.TrackingID.trim() : "";
      if (trackingId && !accountMap.has(trackingId)) {
        accountMap.set(trackingId, trackingId);
      }
    }
  }

  const accounts = Array.from(accountMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));

  return { jobs, accounts };
}

export async function runSimpleReport(input: SimpleReportRequest): Promise<SimpleReportResult> {
  const range = resolveDateRange(input);
  const db = await getDb();
  const rows = await db.all<CacheRow>(
    "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT 50000",
    ["JobProductionTarget"]
  );

  const daily = new Map<string, number>();

  for (const row of rows) {
    const data = JSON.parse(row.data_json) as Record<string, unknown>;
    const job = typeof data.JobNumber === "string" ? data.JobNumber.trim() : "";
    const trackingId = typeof data.TrackingID === "string" ? data.TrackingID.trim() : "";
    const targetDate = typeof data.TargetDate === "string" ? data.TargetDate.slice(0, 10) : "";

    if (!job || !trackingId || !targetDate) continue;
    if (job !== input.jobNumber) continue;
    if (trackingId !== input.trackingId) continue;
    if (targetDate < range.startDate || targetDate > range.endDate) continue;

    const qty = toNumber(data.TargetQuantity);
    daily.set(targetDate, (daily.get(targetDate) ?? 0) + qty);
  }

  const resultRows: SimpleReportRow[] = Array.from(daily.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, targetQuantity]) => ({
      date,
      targetQuantity,
      trackingId: input.trackingId,
      jobNumber: input.jobNumber,
    }));

  const totalQuantity = resultRows.reduce((sum, r) => sum + r.targetQuantity, 0);

  return {
    rows: resultRows,
    totalQuantity,
    dayCount: resultRows.length,
    startDate: range.startDate,
    endDate: range.endDate,
  };
}
