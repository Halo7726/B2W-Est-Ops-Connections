import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { executeReportDefinition } from "@/lib/reports/execute";
import { ReportPdfDocument } from "@/lib/reports/pdf-document";

export const runtime = "nodejs";

function safeFileName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "report"
  );
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const executed = await executeReportDefinition(id, { limit: 4000, recordRun: false });

    if (!executed) {
      return NextResponse.json({ ok: false, error: "Report not found" }, { status: 404 });
    }

    const pdfBuffer = await renderToBuffer(
      <ReportPdfDocument report={executed.report} rows={executed.rows} />
    );

    const fileName = `${safeFileName(executed.report.name)}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      },
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
