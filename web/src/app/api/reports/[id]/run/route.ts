import { NextRequest, NextResponse } from "next/server";
import { executeReportDefinition } from "@/lib/reports/execute";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const limit = Number(url.searchParams.get("limit") ?? "1000");

    const executed = await executeReportDefinition(id, { limit, recordRun: true });

    if (!executed) {
      return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      report: {
        id: executed.report.id,
        name: executed.report.name,
        entity: executed.report.entity,
      },
      rows: executed.rows,
      rowCount: executed.rowCount,
      preview: executed.rows.slice(0, 10),
    });
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
