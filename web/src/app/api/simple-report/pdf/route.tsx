import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { z } from "zod";
import { runSimpleReport } from "@/lib/reports/simple";

export const runtime = "nodejs";

const querySchema = z.object({
  jobNumber: z.string().min(1),
  trackingId: z.string().min(1),
  preset: z.enum(["last7", "last30", "thisMonth", "lastMonth", "custom"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 8 },
  meta: { marginBottom: 3 },
  tableHead: { flexDirection: "row", borderBottom: "1 solid #bbb", marginTop: 8 },
  row: { flexDirection: "row", borderBottom: "1 solid #eee" },
  cellDate: { width: "35%", padding: 4 },
  cellQty: { width: "65%", padding: 4 },
});

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}

function buildPdfDocument(
  parsed: z.infer<typeof querySchema>,
  result: Awaited<ReturnType<typeof runSimpleReport>>
) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Production Tracking Report</Text>
        <Text style={styles.meta}>Job: {parsed.jobNumber}</Text>
        <Text style={styles.meta}>Account: {parsed.trackingId}</Text>
        <Text style={styles.meta}>Range: {result.startDate} to {result.endDate}</Text>
        <Text style={styles.meta}>Total Quantity: {result.totalQuantity.toFixed(2)}</Text>

        <View style={styles.tableHead}>
          <Text style={styles.cellDate}>Date</Text>
          <Text style={styles.cellQty}>Target Quantity</Text>
        </View>

        {result.rows.map((row) => (
          <View key={row.date} style={styles.row}>
            <Text style={styles.cellDate}>{row.date}</Text>
            <Text style={styles.cellQty}>{row.targetQuantity.toFixed(2)}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const parsed = querySchema.parse({
      jobNumber: url.searchParams.get("jobNumber") ?? "",
      trackingId: url.searchParams.get("trackingId") ?? "",
      preset: (url.searchParams.get("preset") ?? "") as
        | "last7"
        | "last30"
        | "thisMonth"
        | "lastMonth"
        | "custom",
      startDate: url.searchParams.get("startDate") ?? undefined,
      endDate: url.searchParams.get("endDate") ?? undefined,
    });

    const result = await runSimpleReport(parsed);

    const buffer = await renderToBuffer(buildPdfDocument(parsed, result));
    const fileName = `${safeFileName(parsed.jobNumber)}-${safeFileName(parsed.trackingId)}.pdf`;

    return new NextResponse(buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=\"${fileName}\"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
