"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { ReportDefinition, ReportRunResult } from "@/lib/reports/api-types";

interface Props {
  report: ReportDefinition;
}

function inferColumns(rows: Record<string, unknown>[]): string[] {
  const first = rows[0];
  if (!first) return [];
  return Object.keys(first);
}

function toDisplay(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function ReportRunClient({ report }: Props) {
  const [result, setResult] = useState<ReportRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const runReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${report.id}/run?limit=2000`, { cache: "no-store" });
      const data = (await res.json()) as ReportRunResult & { error?: string; ok: boolean };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Unable to run report");
      }
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [report.id]);

  async function syncFromOps() {
    setSyncing(true);
    setError(null);
    try {
      const body: { entity: string; top: number } = { entity: report.entity, top: 500 };
      const jobFilter = report.filters.find((f) => f.field === "JobNumber" && typeof f.value === "string");
      if (jobFilter && typeof jobFilter.value === "string" && jobFilter.value.trim()) {
        body.entity = report.entity;
      }

      const res = await fetch("/api/ops/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Sync failed");
      }
      await runReport();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    void runReport();
  }, [runReport]);

  const columns = useMemo(() => inferColumns(result?.rows ?? []), [result]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={runReport}
          disabled={loading}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {loading ? "Running..." : "Run Report"}
        </button>
        <button
          onClick={syncFromOps}
          disabled={syncing}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          {syncing ? "Syncing..." : "Refresh from OPS"}
        </button>
        <Link
          href={`/api/reports/${report.id}/pdf`}
          className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-2 text-sm text-cyan-900 hover:bg-cyan-100"
        >
          Download PDF
        </Link>
        <Link
          href={`/reports/${report.id}/edit`}
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Edit
        </Link>
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-lg border border-zinc-200 bg-white p-3">
        <p className="text-sm text-zinc-600">
          Rows: <span className="font-semibold text-zinc-900">{result?.rowCount ?? 0}</span>
        </p>
      </div>

      <div className="overflow-auto rounded-lg border border-zinc-200 bg-white">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-zinc-50 text-left text-zinc-600">
              {columns.map((c) => (
                <th key={c} className="border-b border-zinc-200 px-3 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(result?.rows ?? []).map((row, idx) => (
              <tr key={idx} className="odd:bg-white even:bg-zinc-50/50">
                {columns.map((c) => (
                  <td key={c} className="max-w-[320px] border-b border-zinc-100 px-3 py-2 align-top text-zinc-700">
                    <span className="line-clamp-3" title={toDisplay(row[c])}>{toDisplay(row[c])}</span>
                  </td>
                ))}
              </tr>
            ))}
            {(result?.rows.length ?? 0) === 0 && (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-3 py-6 text-center text-zinc-500">
                  No rows returned.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
