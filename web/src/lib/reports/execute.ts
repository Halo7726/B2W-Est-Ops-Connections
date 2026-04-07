import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import {
  applyFilters,
  applyGroupings,
  applySorts,
  selectColumns,
} from "@/lib/reports/engine";
import type { ReportDefinition } from "@/lib/reports/api-types";
import type {
  ReportColumn,
  ReportFilter,
  ReportGrouping,
  ReportSort,
} from "@/lib/reports/types";

type ReportRow = {
  id: string;
  name: string;
  description: string | null;
  entity: string;
  filters_json: string;
  sorts_json: string;
  columns_json: string;
  groupings_json: string;
  is_shared: number;
  created_at: string;
  updated_at: string;
};

type CacheRow = {
  data_json: string;
};

function mapReport(row: ReportRow): ReportDefinition {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    entity: row.entity,
    filters: JSON.parse(row.filters_json),
    sorts: JSON.parse(row.sorts_json),
    columns: JSON.parse(row.columns_json),
    groupings: JSON.parse(row.groupings_json),
    isShared: row.is_shared === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function executeReportDefinition(
  reportId: string,
  options?: { limit?: number; recordRun?: boolean }
): Promise<{ report: ReportDefinition; rows: Record<string, unknown>[]; rowCount: number } | null> {
  const db = await getDb();
  const row = await db.get<ReportRow>("SELECT * FROM report_definitions WHERE id = ?", [reportId]);

  if (!row) {
    return null;
  }

  const report = mapReport(row);
  const limit = options?.limit ?? 1000;

  const cacheRows = await db.all<CacheRow>(
    "SELECT data_json FROM ops_cache WHERE entity = ? ORDER BY fetched_at DESC LIMIT ?",
    [report.entity, Number.isFinite(limit) ? limit : 1000]
  );

  const rawRows = cacheRows.map((r) => JSON.parse(r.data_json) as Record<string, unknown>);
  const filters = report.filters as ReportFilter[];
  const sorts = report.sorts as ReportSort[];
  const columns = report.columns as ReportColumn[];
  const groupings = report.groupings as ReportGrouping[];

  const filtered = applyFilters(rawRows, filters);
  const sorted = applySorts(filtered, sorts);
  const grouped = applyGroupings(sorted, groupings);
  const selected = selectColumns(grouped, columns);

  if (options?.recordRun ?? true) {
    await db.run(
      "INSERT INTO report_runs(id, report_definition_id, row_count) VALUES (?, ?, ?)",
      [randomUUID(), report.id, selected.length]
    );
  }

  return {
    report,
    rows: selected,
    rowCount: selected.length,
  };
}
