import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer, Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { z } from "zod";
import { runSimpleReport } from "@/lib/reports/simple";

export const runtime = "nodejs";

const querySchema = z.object({
  jobNumber: z.string().min(1),
  trackingId: z.string().min(1),
  preset: z.enum(["all", "last7", "last30", "thisMonth", "lastMonth", "custom"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 8 },
  meta: { marginBottom: 3 },
  sectionTitle: { fontSize: 12, fontWeight: 700, marginTop: 12, marginBottom: 4 },
  accountBox: { padding: 6, backgroundColor: "#f8fafc", border: "1 solid #e2e8f0", marginBottom: 8 },
  tableHead: { flexDirection: "row", borderBottom: "1 solid #bbb", marginTop: 8, backgroundColor: "#f8fafc" },
  row: { flexDirection: "row", borderBottom: "1 solid #eee" },
  cellDate: { width: "14%", padding: 4 },
  cellQty: { width: "12%", padding: 4 },
  cellCrew: { width: "14%", padding: 4 },
  cellForeman: { width: "16%", padding: 4 },
  cellSize: { width: "8%", padding: 4 },
  cellDuration: { width: "10%", padding: 4 },
  cellSite: { width: "14%", padding: 4 },
  cellNotes: { width: "12%", padding: 4 },
});

function safeFileName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "report";
}

function buildPdfDocument(
  parsed: z.infer<typeof querySchema>,
  result: Awaited<ReturnType<typeof runSimpleReport>>
) {
  const rangeLabel =
    parsed.preset === "all"
      ? "All Time"
      : `${result.startDate} to ${result.endDate}`;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Production Tracking Report</Text>
        <Text style={styles.meta}>Job: {parsed.jobNumber}</Text>
        <Text style={styles.meta}>Tracking Account: {parsed.trackingId}</Text>
        <Text style={styles.meta}>Range: {rangeLabel}</Text>
        <Text style={styles.meta}>Total Quantity: {result.totalQuantity.toFixed(2)}</Text>

        {result.accountInfo && (
          <>
            <Text style={styles.sectionTitle}>Account Details</Text>
            <View style={styles.accountBox}>
              {result.accountInfo.description ? (
                <Text style={styles.meta}>Description: {result.accountInfo.description}</Text>
              ) : null}
              {result.accountInfo.unitOfMeasure ? (
                <Text style={styles.meta}>Unit of Measure: {result.accountInfo.unitOfMeasure}</Text>
              ) : null}
              {result.accountInfo.originalEstimatedQuantity !== null ? (
                <Text style={styles.meta}>
                  Original Est. Quantity: {result.accountInfo.originalEstimatedQuantity.toFixed(2)}
                </Text>
              ) : null}
              {result.accountInfo.projectedTotalQuantity !== null ? (
                <Text style={styles.meta}>
                  Projected Total Quantity: {result.accountInfo.projectedTotalQuantity.toFixed(2)}
                </Text>
              ) : null}
            </View>
          </>
        )}

        <Text style={styles.sectionTitle}>Production History</Text>
        <View style={styles.tableHead}>
          <Text style={styles.cellDate}>Date</Text>
          <Text style={styles.cellQty}>Qty</Text>
          <Text style={styles.cellCrew}>Crew ID</Text>
          <Text style={styles.cellForeman}>Foreman ID</Text>
          <Text style={styles.cellSize}>Crew Size</Text>
          <Text style={styles.cellDuration}>Duration</Text>
          <Text style={styles.cellSite}>Site</Text>
          <Text style={styles.cellNotes}>Notes</Text>
        </View>

        {result.rows.map((row, idx) => (
          <View key={idx} style={styles.row}>
            <Text style={styles.cellDate}>{row.date}</Text>
            <Text style={styles.cellQty}>{row.targetQuantity.toFixed(2)}</Text>
            <Text style={styles.cellCrew}>{row.crewId || "-"}</Text>
            <Text style={styles.cellForeman}>{row.crewForemanEmployeeId || "-"}</Text>
            <Text style={styles.cellSize}>{row.crewSize ?? "-"}</Text>
            <Text style={styles.cellDuration}>{row.duration != null ? row.duration.toFixed(1) : "-"}</Text>
            <Text style={styles.cellSite}>{row.jobSiteDescription || "-"}</Text>
            <Text style={styles.cellNotes}>{row.notes || "-"}</Text>
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
