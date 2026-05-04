import { NextRequest, NextResponse } from "next/server";
import { fetchEstSchema } from "@/lib/est/client";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { entity: string[] } }
) {
  const entity = Array.isArray(params.entity) ? params.entity.join("/") : params.entity;
  const schema = await fetchEstSchema(entity);
  return NextResponse.json({ ok: true, entity, schema });
}
