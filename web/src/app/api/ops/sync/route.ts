import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchOpsAll } from "@/lib/ops/client";
import { getDb } from "@/lib/db/client";

export const runtime = "nodejs";

const requestSchema = z.object({
  entity: z.string().min(1),
  jobNumber: z.string().optional(),
  filter: z.string().optional(),
  top: z.number().int().min(1).max(5000).optional(),
});

function combineFilters(jobNumber?: string, customFilter?: string): string | undefined {
  const parts: string[] = [];
  if (jobNumber) parts.push(`JobNumber eq '${jobNumber.replace(/'/g, "''")}'`);
  if (customFilter) parts.push(`(${customFilter})`);
  if (!parts.length) return undefined;
  return parts.join(" and ");
}

export async function POST(request: NextRequest) {
  try {
    const parsed = requestSchema.parse(await request.json());
    const db = await getDb();
    const filter = combineFilters(parsed.jobNumber, parsed.filter);

    const rows = await fetchOpsAll<Record<string, unknown>>(parsed.entity, {
      filter,
      top: parsed.top ?? 500,
    });

    let upserts = 0;

    for (const row of rows) {
      const objectId = String(row.ObjectID ?? row.objectId ?? row.id ?? "").trim();
      if (!objectId) continue;

      const jobNumber =
        typeof row.JobNumber === "string"
          ? row.JobNumber
          : typeof row.JobID === "string"
            ? row.JobID
            : null;

      await db.run(
        `
        INSERT INTO ops_cache(entity, object_id, job_number, data_json, fetched_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(entity, object_id)
        DO UPDATE SET
          job_number = excluded.job_number,
          data_json = excluded.data_json,
          fetched_at = CURRENT_TIMESTAMP
        `,
        [parsed.entity, objectId, jobNumber, JSON.stringify(row)]
      );

      upserts += 1;
    }

    await db.run(
      `
      INSERT INTO cache_meta(entity, job_number, rows_synced, last_synced_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(entity, job_number)
      DO UPDATE SET
        rows_synced = excluded.rows_synced,
        last_synced_at = CURRENT_TIMESTAMP
      `,
      [parsed.entity, parsed.jobNumber ?? "", upserts]
    );

    return NextResponse.json({
      ok: true,
      entity: parsed.entity,
      rowsFetched: rows.length,
      rowsUpserted: upserts,
      jobNumber: parsed.jobNumber ?? null,
      syncedAt: new Date().toISOString(),
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
