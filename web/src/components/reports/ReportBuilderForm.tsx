"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import FilterBuilder from "@/components/reports/FilterBuilder";
import SortBuilder from "@/components/reports/SortBuilder";
import ColumnBuilder from "@/components/reports/ColumnBuilder";
import GroupingBuilder from "@/components/reports/GroupingBuilder";
import {
  ENTITY_NAMES,
  getEntityFields,
  getEntityLabel,
} from "@/lib/ops/entities";
import { reportDefinitionInputSchema } from "@/lib/reports/types";
import type { ReportDefinition } from "@/lib/reports/api-types";

interface Props {
  mode: "create" | "edit";
  initial?: ReportDefinition;
}

const STORM_DRAIN_PRESET_NAME = "Storm Drain Production by Week";

export default function ReportBuilderForm({ mode, initial }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [entity, setEntity] = useState(initial?.entity ?? "JobProductionTarget");
  const [filters, setFilters] = useState(initial?.filters ?? []);
  const [sorts, setSorts] = useState(initial?.sorts ?? []);
  const [columns, setColumns] = useState(initial?.columns ?? []);
  const [groupings, setGroupings] = useState(initial?.groupings ?? []);
  const [isShared, setIsShared] = useState(initial?.isShared ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = useMemo(() => getEntityFields(entity), [entity]);

  function applyStormDrainPreset() {
    setEntity("JobProductionTarget");
    setName(STORM_DRAIN_PRESET_NAME);
    setDescription("Weekly LF-style production target summary by job and tracking id.");
    setFilters([
      { field: "JobNumber", operator: "eq", value: "", conjunction: "and" },
      { field: "TargetDate", operator: "ge", value: "2026-01-01", conjunction: "and" },
      { field: "TargetDate", operator: "le", value: "2026-12-31", conjunction: "and" },
    ]);
    setSorts([
      { field: "TargetDate", direction: "asc" },
      { field: "TrackingID", direction: "asc" },
    ]);
    setColumns([
      { field: "JobNumber", label: "Job", visible: true },
      { field: "TrackingID", label: "Tracking", visible: true },
      { field: "TargetDate", label: "Date", visible: true },
      { field: "TargetQuantity", label: "Target Qty", visible: true },
    ]);
    setGroupings([
      {
        field: "TargetDate",
        bucket: "week",
        aggregate: "sum",
        aggregateField: "TargetQuantity",
        alias: "weekly_target_qty",
      },
    ]);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = reportDefinitionInputSchema.parse({
        name,
        description,
        entity,
        filters,
        sorts,
        columns,
        groupings,
        isShared,
      });

      const url = mode === "create" ? "/api/reports" : `/api/reports/${initial?.id}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok: boolean; error?: string; report?: ReportDefinition };

      if (!res.ok || !data.ok || !data.report) {
        throw new Error(data.error ?? "Unable to save report");
      }

      router.push(`/reports/${data.report.id}/run`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-zinc-900">Definition</h2>
          <button
            type="button"
            onClick={applyStormDrainPreset}
            className="rounded-md border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-sm text-cyan-900 hover:bg-cyan-100"
          >
            Apply Storm Drain Starter
          </button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium text-zinc-700">Report Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-zinc-700">Entity</span>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm"
            >
              {ENTITY_NAMES.map((n) => (
                <option key={n} value={n}>
                  {getEntityLabel(n)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-medium text-zinc-700">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="inline-flex items-center gap-2 rounded border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 md:col-span-2">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
            />
            Shared report
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Filters</h2>
        <p className="mt-1 text-sm text-zinc-600">Create unlimited conditions with AND/OR logic.</p>
        <div className="mt-3">
          <FilterBuilder fields={fields} filters={filters} onChange={setFilters} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Sort Order</h2>
        <div className="mt-3">
          <SortBuilder fields={fields} sorts={sorts} onChange={setSorts} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Columns</h2>
        <div className="mt-3">
          <ColumnBuilder fields={fields} columns={columns} onChange={setColumns} />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-4">
        <h2 className="text-lg font-semibold text-zinc-900">Grouping & Aggregation</h2>
        <p className="mt-1 text-sm text-zinc-600">Use week/month buckets and count or sum metrics.</p>
        <div className="mt-3">
          <GroupingBuilder fields={fields} groupings={groupings} onChange={setGroupings} />
        </div>
      </section>

      {error && <p className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : mode === "create" ? "Create Report" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/reports")}
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
