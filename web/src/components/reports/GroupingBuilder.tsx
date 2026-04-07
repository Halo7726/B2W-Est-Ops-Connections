"use client";

import type { EntityField } from "@/lib/ops/entities";
import type { ReportGrouping } from "@/lib/reports/types";

interface Props {
  fields: EntityField[];
  groupings: ReportGrouping[];
  onChange: (groupings: ReportGrouping[]) => void;
}

const EMPTY_GROUPING: ReportGrouping = {
  field: "",
  bucket: "none",
  aggregate: "count",
  alias: "value",
};

export default function GroupingBuilder({ fields, groupings, onChange }: Props) {
  function add() {
    onChange([...groupings, { ...EMPTY_GROUPING, field: fields[0]?.name ?? "" }]);
  }

  function remove(i: number) {
    onChange(groupings.filter((_, idx) => idx !== i));
  }

  function update(i: number, patch: Partial<ReportGrouping>) {
    onChange(groupings.map((g, idx) => (idx === i ? { ...g, ...patch } : g)));
  }

  return (
    <div className="space-y-2">
      {groupings.map((g, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          <select
            value={g.field}
            onChange={(e) => update(i, { field: e.target.value })}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
          >
            {fields.length === 0 && <option value={g.field}>{g.field || "-"}</option>}
            {fields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.label}
              </option>
            ))}
          </select>

          {fields.length === 0 && (
            <input
              type="text"
              placeholder="Field name"
              value={g.field}
              onChange={(e) => update(i, { field: e.target.value })}
              className="w-36 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          )}

          <select
            value={g.bucket}
            onChange={(e) => update(i, { bucket: e.target.value as ReportGrouping["bucket"] })}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
          >
            <option value="none">No bucket</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>

          <select
            value={g.aggregate}
            onChange={(e) => update(i, { aggregate: e.target.value as ReportGrouping["aggregate"] })}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
          >
            <option value="count">Count</option>
            <option value="sum">Sum</option>
          </select>

          {g.aggregate === "sum" && (
            <select
              value={g.aggregateField ?? ""}
              onChange={(e) => update(i, { aggregateField: e.target.value })}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
            >
              <option value="">Select numeric field</option>
              {fields
                .filter((f) => f.type === "number")
                .map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.label}
                  </option>
                ))}
            </select>
          )}

          <input
            type="text"
            placeholder="Output alias"
            value={g.alias ?? ""}
            onChange={(e) => update(i, { alias: e.target.value })}
            className="w-32 rounded border border-zinc-300 px-2 py-1 text-sm"
          />

          <button
            type="button"
            onClick={() => remove(i)}
            className="ml-auto rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            x
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        + Add Grouping
      </button>
    </div>
  );
}
