import { getDb } from "@/lib/db/client";
import type { ReportDefinition } from "@/lib/reports/api-types";

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

export async function listReports(): Promise<ReportDefinition[]> {
  const db = await getDb();
  const rows = await db.all<ReportRow>(
    "SELECT * FROM report_definitions ORDER BY updated_at DESC, name ASC"
  );
  return rows.map(mapReport);
}

export async function getReportById(id: string): Promise<ReportDefinition | null> {
  const db = await getDb();
  const row = await db.get<ReportRow>("SELECT * FROM report_definitions WHERE id = ?", [id]);
  return row ? mapReport(row) : null;
}
