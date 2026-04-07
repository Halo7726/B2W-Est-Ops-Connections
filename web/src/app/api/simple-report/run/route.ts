import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runSimpleReport } from "@/lib/reports/simple";

export const runtime = "nodejs";

const requestSchema = z.object({
  jobNumber: z.string().min(1),
  trackingId: z.string().min(1),
  preset: z.enum(["last7", "last30", "thisMonth", "lastMonth", "custom"]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.parse(await request.json());
    const result = await runSimpleReport(parsed);

    return NextResponse.json({
      ok: true,
      ...result,
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
