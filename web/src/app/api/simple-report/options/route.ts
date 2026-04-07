import { NextRequest, NextResponse } from "next/server";
import { getSimpleReportOptions } from "@/lib/reports/simple";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const jobNumber = url.searchParams.get("jobNumber")?.trim() || undefined;
    const options = await getSimpleReportOptions(jobNumber);
    return NextResponse.json({ ok: true, ...options });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 400 }
    );
  }
}
