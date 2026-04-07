"use client";

import type { EntityField } from "@/lib/ops/entities";
import type { ReportSort } from "@/lib/reports/types";

interface Props {
  fields: EntityField[];
  sorts: ReportSort[];
  onChange: (sorts: ReportSort[]) => void;
}

const EMPTY_SORT: ReportSort = { field: "", direction: "asc" };

export default function SortBuilder({ fields, sorts, onChange }: Props) {
  function add() {
    onChange([...sorts, { ...EMPTY_SORT, field: fields[0]?.name ?? "" }]);
  }

  function remove(i: number) {
    onChange(sorts.filter((_, idx) => idx !== i));
  }

  function update(i: number, patch: Partial<ReportSort>) {
    onChange(sorts.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...sorts];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }

  function moveDown(i: number) {
    if (i === sorts.length - 1) return;
    const next = [...sorts];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {sorts.map((s, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          <span className="text-xs text-zinc-400">
            {i + 1}.
          </span>

          <select
            value={s.field}
            onChange={(e) => update(i, { field: e.target.value })}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
          >
            {fields.length === 0 && <option value={s.field}>{s.field || "—"}</option>}
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
              value={s.field}
              onChange={(e) => update(i, { field: e.target.value })}
              className="w-36 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          )}

          <select
            value={s.direction}
            onChange={(e) => update(i, { direction: e.target.value as "asc" | "desc" })}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
          >
            <option value="asc">Ascending ↑</option>
            <option value="desc">Descending ↓</option>
          </select>

          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => moveUp(i)}
              disabled={i === 0}
              className="rounded px-1 py-1 text-xs text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
              title="Move up"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => moveDown(i)}
              disabled={i === sorts.length - 1}
              className="rounded px-1 py-1 text-xs text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
              title="Move down"
            >
              ▼
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        + Add Sort
      </button>
    </div>
  );
}
