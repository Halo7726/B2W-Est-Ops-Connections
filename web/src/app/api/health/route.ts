import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";

export const runtime = "nodejs";

export async function GET() {
  const config = getConfig();
  return NextResponse.json({
    ok: true,
    dbMode: config.db.mode,
    timestamp: new Date().toISOString(),
  });
}
