import { NextRequest, NextResponse } from "next/server";
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

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await getDb();
  const row = await db.get<ReportRow>(`SELECT * FROM report_definitions WHERE id = ?`, [id]);

  if (!row) {
    return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, report: mapReport(row) });
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const parsed = reportDefinitionInputSchema.parse(await request.json());
    const db = await getDb();

    const existing = await db.get<{ id: string }>(`SELECT id FROM report_definitions WHERE id = ?`, [id]);
    if (!existing) {
      return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
    }

    await db.run(
      `
      UPDATE report_definitions
      SET
        name = ?,
        description = ?,
        entity = ?,
        filters_json = ?,
        sorts_json = ?,
        columns_json = ?,
        groupings_json = ?,
        is_shared = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        parsed.name,
        parsed.description ?? null,
        parsed.entity,
        JSON.stringify(parsed.filters),
        JSON.stringify(parsed.sorts),
        JSON.stringify(parsed.columns),
        JSON.stringify(parsed.groupings),
        parsed.isShared ? 1 : 0,
        id,
      ]
    );

    const updated = await db.get<ReportRow>(`SELECT * FROM report_definitions WHERE id = ?`, [id]);

    return NextResponse.json({ ok: true, report: updated ? mapReport(updated) : null });
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

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const db = await getDb();
  const existing = await db.get<{ id: string }>(`SELECT id FROM report_definitions WHERE id = ?`, [id]);

  if (!existing) {
    return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
  }

  await db.run(`DELETE FROM report_definitions WHERE id = ?`, [id]);
  return NextResponse.json({ ok: true });
}
