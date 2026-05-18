import { getDb } from "@/lib/db/client";
import {
  normalizeBoolean,
  normalizeDateString,
  normalizeNumberStrict,
  normalizeString,
  parseCachedJsonStrict,
} from "@/lib/reports/transform";
import { AVAILABLE_COLUMNS, type ColumnKey } from "@/lib/reports/columns";

export type { ColumnKey } from "@/lib/reports/columns";
export { AVAILABLE_COLUMNS } from "@/lib/reports/columns";

export type DatePreset = "all" | "last7" | "last30" | "thisMonth" | "lastMonth" | "custom";

export interface SimpleReportRequest {
  jobNumber: string;
  trackingId: string;
  preset: DatePreset;
  startDate?: string;
  endDate?: string;
  selectedColumns?: ColumnKey[];
}

export interface SimpleReportRow extends Record<string, unknown> {
  date: string;
  sourceEntity?: string;
  targetQuantity: number;
  trackingId: string;
  jobNumber: string;
  projectManagerId?: string;
  projectManagerName?: string;
  siteSupervisorEmployeeId?: string;
  siteSupervisorName?: string;
  itemId?: string;
  itemNumber?: string;
  originalUnitBidPrice?: number | null;
  originalTotalBidPrice?: number | null;
  changeOrderUnitBidPrice?: number | null;
  changeOrderTotalBidPrice?: number | null;
  costBreakdownElementId?: string;
  estimatedQuantity?: number | null;
  totalEmployeeDollars?: number | null;
  totalEquipmentOwnedDollars?: number | null;
  totalSubcontractorDollars?: number | null;
  totalTruckingDollars?: number | null;
  crewId: string;
  crewForemanEmployeeId: string;
  crewForemanName?: string;
  crewSize: number | null;
  duration: number | null;
  notes: string;
  jobSiteDescription: string;
  productionMethod: string;
  crewWorkType?: string;
  targetMethod?: string;
  productionRate?: number | null;
  unitOfMeasure?: string;
  originalEstimatedQuantity?: number | null;
  changeOrderQuantity?: number | null;
  projectedTotalQuantity?: number | null;
  description?: string;
}

export interface AccountInfo {
  trackingId: string;
  description: string;
  unitOfMeasure: string;
  originalEstimatedQuantity: number | null;
  projectedTotalQuantity: number | null;
  jobNumber: string;
}

export interface SimpleReportResult {
  rows: SimpleReportRow[];
  totalQuantity: number;
  dayCount: number;
  startDate: string;
  endDate: string;
  accountInfo: AccountInfo | null;
}

type CacheRow = {
  data_json: string;
  fetched_at?: string;
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

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesTracking(candidate: string, selectedTrackingId: string): boolean {
  if (!candidate || !selectedTrackingId) return false;
  if (candidate === selectedTrackingId) return true;

  const a = normalizeKey(candidate);
  const b = normalizeKey(selectedTrackingId);
  if (!a || !b) return false;
  if (a === b) return true;

  // Allow light fuzzy matching for IDs with formatting differences.
  if (a.length >= 4 && b.includes(a)) return true;
  if (b.length >= 4 && a.includes(b)) return true;
  return false;
}

function firstNonEmptyString(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return undefined;
}

function firstNonNullNumber(...values: Array<number | null | undefined>): number | undefined {
  for (const value of values) {
    if (typeof value === "number") {
      return value;
    }
  }
  return undefined;
}

function setIfMissing<T extends Record<string, unknown>>(obj: T, key: keyof T, value: unknown): void {
  const current = obj[key];
  const missing =
    current === undefined ||
    current === null ||
    (typeof current === "string" && current.trim().length === 0);
  if (missing && value !== undefined && value !== null) {
    obj[key] = value as T[keyof T];
  }
}

function resolveFallbackDate(data: Record<string, unknown>, row: CacheRow, defaultDate: string): string {
  const explicitTargetDate = normalizeDateString(data.TargetDate);
  if (explicitTargetDate) return explicitTargetDate;

  const fetchedDate = normalizeDateString(row.fetched_at);
  if (fetchedDate) return fetchedDate;

  return defaultDate;
}

function resolveDateRange(input: SimpleReportRequest): { startDate: string; endDate: string } {
  if (input.preset === "all") {
    return { startDate: "1000-01-01", endDate: "2099-12-31" };
  }

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

  const accountRows = await db.all<CacheRow>(
    "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT 30000",
    ["JobProductionAccount"]
  );

  const accountJobSet = new Set<string>();
  for (const row of accountRows) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) continue;

    const rowJob = normalizeString(data.JobNumber);
    if (rowJob) accountJobSet.add(rowJob);
  }

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

    // Keep job selector aligned to jobs that have production accounts cached.
    if (accountJobSet.size > 0 && !accountJobSet.has(num)) continue;

    const title = normalizeString(data.Title);
    const label = title ? `${num} - ${title}` : num;
    jobOptions.push({ value: num, label });
  }

  if (skippedJobRows > 0) {
    console.warn(`Simple report options skipped ${skippedJobRows} invalid cached Job rows`);
  }

  jobOptions.sort((a, b) => a.value.localeCompare(b.value));

  // Fallback: if Job entity cache is empty, derive job list from JobProductionAccount
  let jobs: JobOption[];
  if (jobOptions.length > 0) {
    jobs = jobOptions;
  } else {
    jobs = Array.from(accountJobSet)
      .sort((a, b) => a.localeCompare(b))
      .map((j) => ({ value: j, label: j }));
  }

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

  const accounts = Array.from(accountMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));

  return { jobs, accounts };
}

export async function runSimpleReport(input: SimpleReportRequest): Promise<SimpleReportResult> {
  const range = resolveDateRange(input);
  const db = await getDb();

  // Pre-load all account data for this job keyed by tracking ID
  const accountDataMap = new Map<string, Record<string, unknown>>();
  const accountRowsResult = await db.all<CacheRow>(
    `SELECT data_json FROM ops_cache
     WHERE entity = ?
       AND (job_number = ? OR job_number IS NULL OR job_number = '')
     ORDER BY fetched_at DESC
     LIMIT 5000`,
    ["JobProductionAccount", input.jobNumber]
  );

  for (const row of accountRowsResult) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) continue;

    const rowTracking = normalizeString(data.TrackingID);
    if (rowTracking) {
      accountDataMap.set(rowTracking, data);
    }
  }

  let projectManagerId = "";
  const projectManagerRows = await db.all<CacheRow>(
    `SELECT data_json FROM ops_cache
     WHERE entity = ?
       AND (job_number = ? OR job_number IS NULL OR job_number = '')
     ORDER BY fetched_at DESC
     LIMIT 200`,
    ["JobProjectManager", input.jobNumber]
  );

  for (const row of projectManagerRows) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) continue;
    const rowJob = normalizeString(data.JobNumber);
    if (rowJob !== input.jobNumber) continue;
    const pm = normalizeString(data.ProjectManagerID);
    if (pm) {
      projectManagerId = pm;
      break;
    }
  }

  let siteSupervisorEmployeeId = "";
  const siteRows = await db.all<CacheRow>(
    `SELECT data_json FROM ops_cache
     WHERE entity = ?
       AND (job_number = ? OR job_number IS NULL OR job_number = '')
     ORDER BY fetched_at DESC
     LIMIT 500`,
    ["JobSite", input.jobNumber]
  );

  for (const row of siteRows) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) continue;
    const rowJob = normalizeString(data.JobNumber);
    if (rowJob !== input.jobNumber) continue;
    const supervisor = normalizeString(data.SiteSupervisorEmployeeID);
    if (supervisor) {
      siteSupervisorEmployeeId = supervisor;
      break;
    }
  }

  // Load all employees for name matching
  type EmployeeEntry = {
    employeeId: string;
    firstName: string;
    lastName: string;
    jobTitle: string;
    email: string;
  };

  const employeeMap = new Map<string, EmployeeEntry>();
  const employeeRows = await db.all<CacheRow>(
    `SELECT data_json FROM ops_cache
     WHERE entity = ?
     ORDER BY fetched_at DESC
     LIMIT 50000`,
    ["Employee"]
  );

  for (const row of employeeRows) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) continue;
    const eid = normalizeString(data.EmployeeID);
    if (!eid) continue;
    const firstName = normalizeString(data.FirstName);
    const lastName = normalizeString(data.LastName);
    if (!lastName) continue;

    // Store with normalized key for case-insensitive lookup
    employeeMap.set(eid.toLowerCase(), {
      employeeId: eid,
      firstName: firstName,
      lastName: lastName,
      jobTitle: normalizeString(data.JobTitle),
      email: normalizeString(data.EmailAddress),
    });
  }

  // Helper to get full employee name
  function getEmployeeName(employeeId: string): string {
    if (!employeeId) return "";
    const emp = employeeMap.get(employeeId.toLowerCase());
    if (!emp) return "";
    return `${emp.firstName} ${emp.lastName}`.trim();
  }

  // Query by job_number for efficiency
  const rows = await db.all<CacheRow>(
    `SELECT data_json FROM ops_cache
     WHERE entity = ?
       AND (job_number = ? OR job_number IS NULL OR job_number = '')
     ORDER BY fetched_at DESC
     LIMIT 10000`,
    ["JobProductionTarget", input.jobNumber]
  );

  type TargetEntry = {
    date: string;
    targetQuantity: number;
    crewId: string;
    crewForemanEmployeeId: string;
    crewWorkType: string;
    crewSize: number | null;
    duration: number | null;
    targetMethod: string;
    productionRate: number | null;
    notes: string;
    jobSiteDescription: string;
    productionMethod: string;
  };

  const daily = new Map<string, TargetEntry>();
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

    const existing = daily.get(targetDate);
    if (existing) {
      existing.targetQuantity += qty;
    } else {
      daily.set(targetDate, {
        date: targetDate,
        targetQuantity: qty,
        crewId: normalizeString(data.CrewID),
        crewForemanEmployeeId: normalizeString(data.CrewForemanEmployeeID),
        crewWorkType: normalizeString(data.CrewWorkType),
        crewSize: normalizeNumberStrict(data.CrewSize),
        duration: normalizeNumberStrict(data.Duration),
        targetMethod: normalizeString(data.TargetMethod),
        productionRate: normalizeNumberStrict(data.ProductionRate),
        notes: normalizeString(data.Notes),
        jobSiteDescription: normalizeString(data.JobSiteDescription),
        productionMethod: normalizeString(data.ProductionMethod),
      });
    }
  }

  if (skippedRows > 0) {
    console.warn(`Simple report run skipped ${skippedRows} invalid cached JobProductionTarget rows`);
  }

  // Get account data for this tracking ID
  const accountData = accountDataMap.get(input.trackingId);

  const resultRows: SimpleReportRow[] = Array.from(daily.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry) => ({
      ...entry,
      sourceEntity: "JobProductionTarget",
      trackingId: input.trackingId,
      jobNumber: input.jobNumber,
      projectManagerId,
      projectManagerName: getEmployeeName(projectManagerId),
      siteSupervisorEmployeeId,
      siteSupervisorName: getEmployeeName(siteSupervisorEmployeeId),
      crewForemanName: getEmployeeName(entry.crewForemanEmployeeId),
      unitOfMeasure: accountData ? normalizeString(accountData.UnitOfMeasure) : "",
      originalEstimatedQuantity: accountData ? normalizeNumberStrict(accountData.OriginalEstimatedQuantity) : null,
      changeOrderQuantity: accountData ? normalizeNumberStrict(accountData.ChangeOrderQuantity) : null,
      projectedTotalQuantity: accountData ? normalizeNumberStrict(accountData.ProjectedTotalQuantity) : null,
      description: accountData ? normalizeString(accountData.Description) : "",
    }));

  // Fallback: when JobProductionTarget is unavailable, use estimate and cost breakdown entities.
  if (resultRows.length === 0) {
    const fallbackRows: SimpleReportRow[] = [];
    const matchedEstimateItemIds = new Set<string>();

    const crewByTracking = new Map<string, {
      crewId: string;
      crewForemanEmployeeId: string;
      crewSize: number | null;
      duration: number | null;
      jobSiteDescription: string;
      productionMethod: string;
      crewWorkType: string;
      targetMethod: string;
      productionRate: number | null;
      notes: string;
      date: string;
    }>();

    const targetRowsForCrew = await db.all<CacheRow>(
      `SELECT data_json, fetched_at FROM ops_cache
       WHERE entity = ?
         AND (job_number = ? OR job_number IS NULL OR job_number = '')
       ORDER BY fetched_at DESC
       LIMIT 10000`,
      ["JobProductionTarget", input.jobNumber]
    );

    for (const row of targetRowsForCrew) {
      const data = parseCachedJsonStrict(row.data_json);
      if (!data) continue;

      const job = normalizeString(data.JobNumber);
      const tracking = normalizeString(data.TrackingID);
      if (job !== input.jobNumber || !tracking) continue;

      const key = normalizeKey(tracking);
      if (crewByTracking.has(key)) continue;

      crewByTracking.set(key, {
        crewId: normalizeString(data.CrewID),
        crewForemanEmployeeId: normalizeString(data.CrewForemanEmployeeID),
        crewSize: normalizeNumberStrict(data.CrewSize),
        duration: normalizeNumberStrict(data.Duration),
        jobSiteDescription: normalizeString(data.JobSiteDescription),
        productionMethod: normalizeString(data.ProductionMethod),
        crewWorkType: normalizeString(data.CrewWorkType),
        targetMethod: normalizeString(data.TargetMethod),
        productionRate: normalizeNumberStrict(data.ProductionRate),
        notes: normalizeString(data.Notes),
        date: resolveFallbackDate(data, row, range.startDate),
      });
    }

    const estimateRows = await db.all<CacheRow>(
      `SELECT data_json, fetched_at FROM ops_cache
       WHERE entity = ?
         AND (job_number = ? OR job_number IS NULL OR job_number = '')
       ORDER BY fetched_at DESC
       LIMIT 10000`,
      ["JobEstimateItem", input.jobNumber]
    );

    for (const row of estimateRows) {
      const data = parseCachedJsonStrict(row.data_json);
      if (!data) continue;

      const job = normalizeString(data.JobNumber);
      if (job !== input.jobNumber) continue;

      const rowTracking = normalizeString(data.TrackingID);
      const itemId = normalizeString(data.ItemID);
      const itemNumber = normalizeString(data.ItemNumber);

      const isMatch =
        matchesTracking(rowTracking, input.trackingId) ||
        matchesTracking(itemId, input.trackingId) ||
        matchesTracking(itemNumber, input.trackingId);
      if (!isMatch) continue;

      if (itemId) matchedEstimateItemIds.add(itemId);

      const crewHint = crewByTracking.get(normalizeKey(input.trackingId));

      const origQty = normalizeNumberStrict(data.OriginalEstimatedQuantity) ?? 0;
      const origUnitPrice = normalizeNumberStrict(data.OriginalUnitBidPrice);
      const coQty = normalizeNumberStrict(data.ChangeOrderQuantity);
      const coUnitPrice = normalizeNumberStrict(data.ChangeOrderUnitBidPrice);
      const origTotalPrice = origQty && origUnitPrice ? origQty * origUnitPrice : null;
      const coTotalPrice = coQty && coUnitPrice ? coQty * coUnitPrice : null;

      fallbackRows.push({
        date: crewHint?.date ?? resolveFallbackDate(data, row, range.startDate),
        sourceEntity: "JobEstimateItem",
        targetQuantity: origQty,
        trackingId: input.trackingId,
        jobNumber: input.jobNumber,
        projectManagerId,
        projectManagerName: getEmployeeName(projectManagerId),
        siteSupervisorEmployeeId,
        siteSupervisorName: getEmployeeName(siteSupervisorEmployeeId),
        itemId,
        itemNumber,
        originalUnitBidPrice: origUnitPrice,
        originalTotalBidPrice: origTotalPrice,
        changeOrderUnitBidPrice: coUnitPrice,
        changeOrderTotalBidPrice: coTotalPrice,
        estimatedQuantity: origQty,
        notes: crewHint?.notes ?? "",
        crewId: crewHint?.crewId ?? "",
        crewForemanEmployeeId: crewHint?.crewForemanEmployeeId ?? "",
        crewForemanName: getEmployeeName(crewHint?.crewForemanEmployeeId ?? ""),
        crewSize: crewHint?.crewSize ?? null,
        duration: crewHint?.duration ?? null,
        jobSiteDescription: crewHint?.jobSiteDescription ?? "",
        productionMethod: crewHint?.productionMethod || "Estimate",
        crewWorkType: crewHint?.crewWorkType,
        targetMethod: crewHint?.targetMethod,
        productionRate: crewHint?.productionRate,
        unitOfMeasure: accountData ? normalizeString(accountData.UnitOfMeasure) : normalizeString(data.UnitOfMeasure),
        originalEstimatedQuantity: accountData
          ? normalizeNumberStrict(accountData.OriginalEstimatedQuantity)
          : normalizeNumberStrict(data.OriginalEstimatedQuantity),
        changeOrderQuantity: accountData
          ? normalizeNumberStrict(accountData.ChangeOrderQuantity)
          : normalizeNumberStrict(data.ChangeOrderQuantity),
        projectedTotalQuantity: accountData ? normalizeNumberStrict(accountData.ProjectedTotalQuantity) : null,
        description: accountData ? normalizeString(accountData.Description) : normalizeString(data.Description),
      });
    }

    const cbeRows = await db.all<CacheRow>(
      `SELECT data_json, fetched_at FROM ops_cache
       WHERE entity = ?
         AND (job_number = ? OR job_number IS NULL OR job_number = '')
       ORDER BY fetched_at DESC
       LIMIT 10000`,
      ["JobCostBreakdownElement", input.jobNumber]
    );

    for (const row of cbeRows) {
      const data = parseCachedJsonStrict(row.data_json);
      if (!data) continue;

      const job = normalizeString(data.JobNumber);
      if (job !== input.jobNumber) continue;

      const trackingCandidate = normalizeString(data.TrackingID);
      const estimateItemId = normalizeString(data.EstimateItemID);
      const matchedByTracking = matchesTracking(trackingCandidate, input.trackingId);
      const matchedByEstimateLink = Boolean(estimateItemId && matchedEstimateItemIds.has(estimateItemId));
      if (!matchedByTracking && !matchedByEstimateLink) continue;

      const crewHint = crewByTracking.get(normalizeKey(input.trackingId));

      fallbackRows.push({
        date: crewHint?.date ?? resolveFallbackDate(data, row, range.startDate),
        sourceEntity: "JobCostBreakdownElement",
        targetQuantity: normalizeNumberStrict(data.EstimatedQuantity) ?? 0,
        trackingId: input.trackingId,
        jobNumber: input.jobNumber,
        projectManagerId,
        projectManagerName: getEmployeeName(projectManagerId),
        siteSupervisorEmployeeId,
        siteSupervisorName: getEmployeeName(siteSupervisorEmployeeId),
        itemId: estimateItemId,
        costBreakdownElementId: normalizeString(data.CostBreakdownElementID),
        estimatedQuantity: normalizeNumberStrict(data.EstimatedQuantity),
        totalEmployeeDollars: normalizeNumberStrict(data.TotalEmployeeDollars),
        totalEquipmentOwnedDollars: normalizeNumberStrict(data.TotalEquipmentOwnedDollars),
        totalSubcontractorDollars: normalizeNumberStrict(data.TotalSubcontractorDollars),
        totalTruckingDollars: normalizeNumberStrict(data.TotalTruckingDollars),
        notes: crewHint?.notes ?? "",
        crewId: crewHint?.crewId ?? "",
        crewForemanEmployeeId: crewHint?.crewForemanEmployeeId ?? "",
        crewForemanName: getEmployeeName(crewHint?.crewForemanEmployeeId ?? ""),
        crewSize: crewHint?.crewSize ?? null,
        duration: crewHint?.duration ?? null,
        jobSiteDescription: crewHint?.jobSiteDescription ?? "",
        productionMethod: crewHint?.productionMethod || "Cost Breakdown",
        crewWorkType: crewHint?.crewWorkType,
        targetMethod: crewHint?.targetMethod,
        productionRate: crewHint?.productionRate,
        unitOfMeasure: accountData ? normalizeString(accountData.UnitOfMeasure) : normalizeString(data.UnitOfMeasure),
        originalEstimatedQuantity: accountData
          ? normalizeNumberStrict(accountData.OriginalEstimatedQuantity)
          : normalizeNumberStrict(data.EstimatedQuantity),
        changeOrderQuantity: accountData ? normalizeNumberStrict(accountData.ChangeOrderQuantity) : null,
        projectedTotalQuantity: accountData ? normalizeNumberStrict(accountData.ProjectedTotalQuantity) : null,
        description: accountData ? normalizeString(accountData.Description) : normalizeString(data.Description),
      });
    }

    resultRows.push(...fallbackRows);
  }

  // Second enrichment pass: merge missing properties from related estimate/cost rows.
  const estimateRowsForEnrichment = await db.all<CacheRow>(
    `SELECT data_json FROM ops_cache
     WHERE entity = ?
       AND (job_number = ? OR job_number IS NULL OR job_number = '')
     ORDER BY fetched_at DESC
     LIMIT 10000`,
    ["JobEstimateItem", input.jobNumber]
  );

  const estimateByTracking = new Map<string, Record<string, unknown>>();
  const estimateByItemId = new Map<string, Record<string, unknown>>();

  for (const row of estimateRowsForEnrichment) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) continue;

    const job = normalizeString(data.JobNumber);
    if (job !== input.jobNumber) continue;

    const tracking = normalizeString(data.TrackingID);
    const itemId = normalizeString(data.ItemID);

    if (tracking) estimateByTracking.set(normalizeKey(tracking), data);
    if (itemId) estimateByItemId.set(normalizeKey(itemId), data);
  }

  const cbeRowsForEnrichment = await db.all<CacheRow>(
    `SELECT data_json FROM ops_cache
     WHERE entity = ?
       AND (job_number = ? OR job_number IS NULL OR job_number = '')
     ORDER BY fetched_at DESC
     LIMIT 10000`,
    ["JobCostBreakdownElement", input.jobNumber]
  );

  const cbeByTracking = new Map<string, Record<string, unknown>>();
  const cbeByItemId = new Map<string, Record<string, unknown>>();

  for (const row of cbeRowsForEnrichment) {
    const data = parseCachedJsonStrict(row.data_json);
    if (!data) continue;

    const job = normalizeString(data.JobNumber);
    if (job !== input.jobNumber) continue;

    const tracking = normalizeString(data.TrackingID);
    const estimateItemId = normalizeString(data.EstimateItemID);

    if (tracking) cbeByTracking.set(normalizeKey(tracking), data);
    if (estimateItemId) cbeByItemId.set(normalizeKey(estimateItemId), data);
  }

  for (const row of resultRows) {
    const trackingKey = row.trackingId ? normalizeKey(row.trackingId) : "";
    const itemKey = row.itemId ? normalizeKey(row.itemId) : "";
    const itemNumberKey = row.itemNumber ? normalizeKey(row.itemNumber) : "";

    const estimate =
      (itemKey && estimateByItemId.get(itemKey)) ||
      (trackingKey && estimateByTracking.get(trackingKey)) ||
      (itemNumberKey && estimateByTracking.get(itemNumberKey));

    const cbe =
      (itemKey && cbeByItemId.get(itemKey)) ||
      (trackingKey && cbeByTracking.get(trackingKey));

    setIfMissing(row, "projectManagerId", projectManagerId);
    setIfMissing(row, "projectManagerName", getEmployeeName(projectManagerId));
    setIfMissing(row, "siteSupervisorEmployeeId", siteSupervisorEmployeeId);
    setIfMissing(row, "siteSupervisorName", getEmployeeName(siteSupervisorEmployeeId));
    setIfMissing(row, "crewForemanName", getEmployeeName(row.crewForemanEmployeeId));

    if (estimate) {
      setIfMissing(row, "sourceEntity", firstNonEmptyString(row.sourceEntity, "JobEstimateItem"));
      setIfMissing(row, "itemId", normalizeString(estimate.ItemID));
      setIfMissing(row, "itemNumber", normalizeString(estimate.ItemNumber));
      setIfMissing(row, "description", normalizeString(estimate.Description));
      setIfMissing(row, "unitOfMeasure", normalizeString(estimate.UnitOfMeasure));
      setIfMissing(row, "estimatedQuantity", normalizeNumberStrict(estimate.OriginalEstimatedQuantity));
      setIfMissing(row, "originalEstimatedQuantity", normalizeNumberStrict(estimate.OriginalEstimatedQuantity));
      const coQtyFromEstimate = normalizeNumberStrict(estimate.ChangeOrderQuantity);
      setIfMissing(row, "changeOrderQuantity", coQtyFromEstimate);
      const origUnitFromEstimate = normalizeNumberStrict(estimate.OriginalUnitBidPrice);
      const coUnitFromEstimate = normalizeNumberStrict(estimate.ChangeOrderUnitBidPrice);
      setIfMissing(row, "originalUnitBidPrice", origUnitFromEstimate);
      setIfMissing(row, "changeOrderUnitBidPrice", coUnitFromEstimate);
      const origQtyFromEstimate = normalizeNumberStrict(estimate.OriginalEstimatedQuantity);
      if (!row.originalTotalBidPrice && origQtyFromEstimate && origUnitFromEstimate) {
        row.originalTotalBidPrice = origQtyFromEstimate * origUnitFromEstimate;
      }
      if (!row.changeOrderTotalBidPrice && coQtyFromEstimate && coUnitFromEstimate) {
        row.changeOrderTotalBidPrice = coQtyFromEstimate * coUnitFromEstimate;
      }

      const fallbackQty = firstNonNullNumber(
        normalizeNumberStrict(estimate.OriginalEstimatedQuantity),
        normalizeNumberStrict(estimate.ChangeOrderQuantity)
      );
      setIfMissing(row, "targetQuantity", fallbackQty);
    }

    if (cbe) {
      setIfMissing(row, "sourceEntity", firstNonEmptyString(row.sourceEntity, "JobCostBreakdownElement"));
      setIfMissing(row, "costBreakdownElementId", normalizeString(cbe.CostBreakdownElementID));
      setIfMissing(row, "estimatedQuantity", normalizeNumberStrict(cbe.EstimatedQuantity));
      setIfMissing(row, "totalEmployeeDollars", normalizeNumberStrict(cbe.TotalEmployeeDollars));
      setIfMissing(row, "totalEquipmentOwnedDollars", normalizeNumberStrict(cbe.TotalEquipmentOwnedDollars));
      setIfMissing(row, "totalSubcontractorDollars", normalizeNumberStrict(cbe.TotalSubcontractorDollars));
      setIfMissing(row, "totalTruckingDollars", normalizeNumberStrict(cbe.TotalTruckingDollars));

      const cbeQty = normalizeNumberStrict(cbe.EstimatedQuantity);
      setIfMissing(row, "targetQuantity", cbeQty);
    }
  }

  const totalQuantity = resultRows.reduce((sum, r) => sum + r.targetQuantity, 0);

  // Build account info for display
  let accountInfo: AccountInfo | null = null;
  if (accountData) {
    accountInfo = {
      trackingId: input.trackingId,
      description: normalizeString(accountData.Description),
      unitOfMeasure: normalizeString(accountData.UnitOfMeasure),
      originalEstimatedQuantity: normalizeNumberStrict(accountData.OriginalEstimatedQuantity),
      projectedTotalQuantity: normalizeNumberStrict(accountData.ProjectedTotalQuantity),
      jobNumber: input.jobNumber,
    };
  }

  return {
    rows: resultRows,
    totalQuantity,
    dayCount: resultRows.length,
    startDate: range.startDate,
    endDate: range.endDate,
    accountInfo,
  };
}
