"use client";

import type { EntityField } from "@/lib/ops/entities";
import type { ReportColumn } from "@/lib/reports/types";

interface Props {
  fields: EntityField[];
  columns: ReportColumn[];
  onChange: (columns: ReportColumn[]) => void;
}

const EMPTY_COLUMN: ReportColumn = {
  field: "",
  label: "",
  visible: true,
};

export default function ColumnBuilder({ fields, columns, onChange }: Props) {
  function add() {
    onChange([...columns, { ...EMPTY_COLUMN, field: fields[0]?.name ?? "" }]);
  }

  function remove(i: number) {
    onChange(columns.filter((_, idx) => idx !== i));
  }

  function update(i: number, patch: Partial<ReportColumn>) {
    onChange(columns.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function moveUp(i: number) {
    if (i === 0) return;
    const next = [...columns];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(next);
  }

  function moveDown(i: number) {
    if (i === columns.length - 1) return;
    const next = [...columns];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      {columns.map((col, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          <span className="text-xs text-zinc-400">{i + 1}.</span>

          <select
            value={col.field}
            onChange={(e) => update(i, { field: e.target.value })}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
          >
            {fields.length === 0 && <option value={col.field}>{col.field || "-"}</option>}
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
              value={col.field}
              onChange={(e) => update(i, { field: e.target.value })}
              className="w-40 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          )}

          <input
            type="text"
            placeholder="Custom label (optional)"
            value={col.label ?? ""}
            onChange={(e) => update(i, { label: e.target.value })}
            className="min-w-[140px] flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
          />

          <label className="inline-flex items-center gap-2 rounded border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700">
            <input
              type="checkbox"
              checked={col.visible}
              onChange={(e) => update(i, { visible: e.target.checked })}
            />
            Visible
          </label>

          <div className="ml-auto flex gap-1">
            <button
              type="button"
              onClick={() => moveUp(i)}
              disabled={i === 0}
              className="rounded px-1 py-1 text-xs text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
              title="Move up"
            >
              ^
            </button>
            <button
              type="button"
              onClick={() => moveDown(i)}
              disabled={i === columns.length - 1}
              className="rounded px-1 py-1 text-xs text-zinc-400 hover:bg-zinc-100 disabled:opacity-30"
              title="Move down"
            >
              v
            </button>
            <button
              type="button"
              onClick={() => remove(i)}
              className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
            >
              x
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={add}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
      >
        + Add Column
      </button>
    </div>
  );
}
