import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { reportDefinitionInputSchema } from "@/lib/reports/types";

export const runtime = "nodejs";

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

function mapReport(row: ReportRow) {
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

export async function GET() {
  const db = await getDb();
  const rows = await db.all<ReportRow>(
    `SELECT * FROM report_definitions ORDER BY updated_at DESC, name ASC`
  );
  return NextResponse.json({ ok: true, reports: rows.map(mapReport) });
}

export async function POST(request: NextRequest) {
  try {
    const parsed = reportDefinitionInputSchema.parse(await request.json());
    const db = await getDb();
    const id = randomUUID();

    await db.run(
      `
      INSERT INTO report_definitions(
        id, name, description, entity, filters_json, sorts_json, columns_json, groupings_json, is_shared
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        parsed.name,
        parsed.description ?? null,
        parsed.entity,
        JSON.stringify(parsed.filters),
        JSON.stringify(parsed.sorts),
        JSON.stringify(parsed.columns),
        JSON.stringify(parsed.groupings),
        parsed.isShared ? 1 : 0,
      ]
    );

    const row = await db.get<ReportRow>(`SELECT * FROM report_definitions WHERE id = ?`, [id]);

    return NextResponse.json({ ok: true, report: row ? mapReport(row) : null }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 400 }
    );
  }
}
