import { getDb } from "@/lib/db/client";
import {
  normalizeBoolean,
  normalizeDateString,
  normalizeNumberStrict,
  normalizeString,
  parseCachedJsonStrict,
} from "@/lib/reports/transform";

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

export async function getSimpleReportOptions(jobNumber?: string): Promise<SimpleReportOptions> {
  const db = await getDb();

  // Primary: build job list from the Job entity (active jobs only, with Title labels)
  const jobEntityRows = await db.all<CacheRow>(
    "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT 10000",
    ["Job"]
  );

  type JobOption = { value: string; label: string };
  const jobOptions: JobOption[] = [];
  let skippedJobRows = 0;

  for (const row of jobEntityRows) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) {
      skippedJobRows += 1;
      continue;
    }
    const isActive = normalizeBoolean(data.IsActive);
    if (isActive === false) continue;

    const num = normalizeString(data.JobNumber);
    if (!num) continue;

    const title = normalizeString(data.Title);
    const label = title ? `${num} - ${title}` : num;
    jobOptions.push({ value: num, label });
  }

  if (skippedJobRows > 0) {
    console.warn(`Simple report options skipped ${skippedJobRows} invalid cached Job rows`);
  }

  jobOptions.sort((a, b) => a.value.localeCompare(b.value));

  // Fallback: if Job entity cache is empty, derive job list from JobProductionTarget (backward compat)
  let jobs: JobOption[];
  if (jobOptions.length > 0) {
    jobs = jobOptions;
  } else {
    const jobRows = await db.all<CacheRow>(
      "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT 30000",
      ["JobProductionTarget"]
    );
    const jobSet = new Set<string>();
    for (const row of jobRows) {
      const data = parseCachedJsonStrict(row.data_json);
      if (!data) continue;

      const job = normalizeString(data.JobNumber);
      if (job) jobSet.add(job);
    }
    jobs = Array.from(jobSet)
      .sort((a, b) => a.localeCompare(b))
      .map((j) => ({ value: j, label: j }));
  }

  const accountRows = await db.all<CacheRow>(
    "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT 30000",
    ["JobProductionAccount"]
  );

  const accountMap = new Map<string, string>();

  for (const row of accountRows) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) continue;

    const rowJob = normalizeString(data.JobNumber);
    if (jobNumber && rowJob !== jobNumber) continue;

    const trackingId = normalizeString(data.TrackingID);
    if (!trackingId) continue;

    const desc = normalizeString(data.Description);
    const uom = normalizeString(data.UnitOfMeasure);
    const label = [trackingId, desc, uom ? `(${uom})` : ""].filter(Boolean).join(" - ");

    if (!accountMap.has(trackingId)) {
      accountMap.set(trackingId, label || trackingId);
    }
  }

  if (accountMap.size === 0) {
    const targetRows = await db.all<CacheRow>(
      "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT 30000",
      ["JobProductionTarget"]
    );

    for (const row of targetRows) {
      const data = parseCachedJsonStrict(row.data_json);
      if (!data) continue;

      const rowJob = normalizeString(data.JobNumber);
      if (jobNumber && rowJob !== jobNumber) continue;

      const trackingId = normalizeString(data.TrackingID);
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
  let skippedRows = 0;

  for (const row of rows) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) {
      skippedRows += 1;
      continue;
    }

    const job = normalizeString(data.JobNumber);
    const trackingId = normalizeString(data.TrackingID);
    const targetDate = normalizeDateString(data.TargetDate);

    if (!job || !trackingId || !targetDate) {
      skippedRows += 1;
      continue;
    }
    if (job !== input.jobNumber) continue;
    if (trackingId !== input.trackingId) continue;
    if (targetDate < range.startDate || targetDate > range.endDate) continue;

    const qty = normalizeNumberStrict(data.TargetQuantity);
    if (qty === null) {
      skippedRows += 1;
      continue;
    }

    daily.set(targetDate, (daily.get(targetDate) ?? 0) + qty);
  }

  if (skippedRows > 0) {
    console.warn(`Simple report run skipped ${skippedRows} invalid cached JobProductionTarget rows`);
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
