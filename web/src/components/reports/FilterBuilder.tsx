"use client";

import { useState } from "react";
import type { EntityField } from "@/lib/ops/entities";
import type { ReportFilter } from "@/lib/reports/types";

const OPERATORS: { value: ReportFilter["operator"]; label: string; needsArray?: boolean }[] = [
  { value: "eq", label: "equals" },
  { value: "ne", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "ge", label: "≥ (greater or equal)" },
  { value: "le", label: "≤ (less or equal)" },
  { value: "contains", label: "contains" },
  { value: "startswith", label: "starts with" },
  { value: "in", label: "in list (comma-separated)", needsArray: true },
];

function filterToOData(f: ReportFilter): string {
  const v = typeof f.value === "string" ? `'${f.value}'` : String(f.value);
  switch (f.operator) {
    case "eq": return `${f.field} eq ${v}`;
    case "ne": return `${f.field} ne ${v}`;
    case "gt": return `${f.field} gt ${v}`;
    case "lt": return `${f.field} lt ${v}`;
    case "ge": return `${f.field} ge ${v}`;
    case "le": return `${f.field} le ${v}`;
    case "contains": return `contains(${f.field}, ${v})`;
    case "startswith": return `startswith(${f.field}, ${v})`;
    case "in": {
      const items = Array.isArray(f.value)
        ? f.value.map((x) => (typeof x === "string" ? `'${x}'` : String(x))).join(", ")
        : String(f.value);
      return `${f.field} in (${items})`;
    }
    default: return "";
  }
}

function filtersToOData(filters: ReportFilter[]): string {
  return filters
    .map((f, i) => {
      const expr = filterToOData(f);
      return i === 0 ? expr : `${f.conjunction} ${expr}`;
    })
    .join(" ");
}

interface Props {
  fields: EntityField[];
  filters: ReportFilter[];
  onChange: (filters: ReportFilter[]) => void;
}

const EMPTY_FILTER: ReportFilter = {
  field: "",
  operator: "eq",
  value: "",
  conjunction: "and",
};

export default function FilterBuilder({ fields, filters, onChange }: Props) {
  const [showOData, setShowOData] = useState(false);

  function add() {
    onChange([...filters, { ...EMPTY_FILTER, field: fields[0]?.name ?? "" }]);
  }

  function remove(i: number) {
    onChange(filters.filter((_, idx) => idx !== i));
  }

  function update(i: number, patch: Partial<ReportFilter>) {
    onChange(filters.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function handleValueChange(i: number, op: ReportFilter["operator"], raw: string) {
    if (op === "in") {
      const arr = raw.split(",").map((s) => s.trim()).filter(Boolean);
      update(i, { value: arr });
    } else {
      update(i, { value: raw });
    }
  }

  function getValueDisplay(f: ReportFilter): string {
    if (Array.isArray(f.value)) return f.value.join(", ");
    return String(f.value ?? "");
  }

  const isNeedArray = (op: ReportFilter["operator"]) =>
    OPERATORS.find((o) => o.value === op)?.needsArray ?? false;

  return (
    <div className="space-y-2">
      {filters.map((f, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2">
          {i > 0 && (
            <select
              value={f.conjunction}
              onChange={(e) => update(i, { conjunction: e.target.value as "and" | "or" })}
              className="rounded border border-zinc-300 bg-white px-2 py-1 text-xs font-semibold uppercase text-zinc-600"
            >
              <option value="and">AND</option>
              <option value="or">OR</option>
            </select>
          )}

          {/* Field picker */}
          <select
            value={f.field}
            onChange={(e) => update(i, { field: e.target.value })}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
          >
            {fields.length === 0 && <option value="">— enter field name below —</option>}
            {fields.map((fld) => (
              <option key={fld.name} value={fld.name}>
                {fld.label}
              </option>
            ))}
          </select>

          {/* For unknown entities, allow free-text field name */}
          {fields.length === 0 && (
            <input
              type="text"
              placeholder="Field name"
              value={f.field}
              onChange={(e) => update(i, { field: e.target.value })}
              className="w-36 rounded border border-zinc-300 px-2 py-1 text-sm"
            />
          )}

          {/* Operator picker */}
          <select
            value={f.operator}
            onChange={(e) => {
              const op = e.target.value as ReportFilter["operator"];
              update(i, { operator: op, value: isNeedArray(op) ? [] : "" });
            }}
            className="rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800"
          >
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>

          {/* Value input */}
          <input
            type="text"
            placeholder={isNeedArray(f.operator) ? "val1, val2, ..." : "value"}
            value={getValueDisplay(f)}
            onChange={(e) => handleValueChange(i, f.operator, e.target.value)}
            className="min-w-[120px] flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
          />

          <button
            type="button"
            onClick={() => remove(i)}
            className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
          >
            ✕
          </button>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50"
        >
          + Add Filter
        </button>

        {filters.length > 0 && (
          <button
            type="button"
            onClick={() => setShowOData((s) => !s)}
            className="text-xs text-zinc-500 underline hover:text-zinc-700"
          >
            {showOData ? "Hide" : "Show"} OData
          </button>
        )}
      </div>

      {showOData && filters.length > 0 && (
        <div className="rounded-md border border-zinc-200 bg-white p-3">
          <p className="mb-1 text-xs font-medium text-zinc-500">Generated $filter string (read-only reference):</p>
          <code className="block whitespace-pre-wrap break-all text-xs text-zinc-700">
            {filtersToOData(filters) || "(no filters)"}
          </code>
        </div>
      )}
    </div>
  );
}
