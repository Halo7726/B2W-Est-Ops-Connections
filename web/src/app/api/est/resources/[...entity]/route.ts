import { NextRequest, NextResponse } from "next/server";
import { createEstItem, deleteEstItem, fetchEstPage, updateEstItem } from "@/lib/est/client";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { entity: string[] } }
) {
  const entity = Array.isArray(params.entity) ? params.entity.join("/") : params.entity;
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") ?? undefined;
  const orderBy = url.searchParams.get("orderBy") ?? undefined;
  const select = url.searchParams.get("select") ?? undefined;
  const top = url.searchParams.has("top") ? Number(url.searchParams.get("top")) : undefined;
  const skip = url.searchParams.has("skip") ? Number(url.searchParams.get("skip")) : undefined;

  const items = await fetchEstPage(entity, { filter, orderBy, select, top, skip });
  return NextResponse.json({ ok: true, entity, items });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { entity: string[] } }
) {
  const entity = Array.isArray(params.entity) ? params.entity.join("/") : params.entity;
  const payload = await request.json();
  const result = await createEstItem(entity, payload);
  return NextResponse.json({ ok: true, entity, result });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { entity: string[] } }
) {
  const entity = Array.isArray(params.entity) ? params.entity.join("/") : params.entity;
  const payload = await request.json();
  const result = await updateEstItem(entity, payload);
  return NextResponse.json({ ok: true, entity, result });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { entity: string[] } }
) {
  const entity = Array.isArray(params.entity) ? params.entity.join("/") : params.entity;
  const url = new URL(request.url);
  const objectId = url.searchParams.get("objectId") ?? undefined;
  const body = await request.json().catch(() => ({}));
  const resolvedObjectId = objectId ?? (body as { objectId?: string }).objectId ?? (body as { ObjectID?: string }).ObjectID;

  if (!resolvedObjectId) {
    return NextResponse.json({ ok: false, error: "Missing objectId for delete request." }, { status: 400 });
  }

  const result = await deleteEstItem(entity, String(resolvedObjectId));
  return NextResponse.json({ ok: true, entity, result });
}
