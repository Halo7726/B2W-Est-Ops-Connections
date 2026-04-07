import {
  type ReportColumn,
  type ReportFilter,
  type ReportGrouping,
  type ReportSort,
} from "@/lib/reports/types";

type JsonRecord = Record<string, unknown>;

function readValue(record: JsonRecord, field: string): unknown {
  return field.split(".").reduce<unknown>((value, key) => {
    if (value && typeof value === "object") {
      return (value as JsonRecord)[key];
    }
    return undefined;
  }, record);
}

function comparePrimitive(left: unknown, right: unknown): number {
  if (left === right) return 0;
  if (left == null) return -1;
  if (right == null) return 1;
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left).localeCompare(String(right));
}

function matchFilter(row: JsonRecord, filter: ReportFilter): boolean {
  const value = readValue(row, filter.field);

  switch (filter.operator) {
    case "eq":
      return value === filter.value;
    case "ne":
      return value !== filter.value;
    case "gt":
      return comparePrimitive(value, filter.value) > 0;
    case "lt":
      return comparePrimitive(value, filter.value) < 0;
    case "ge":
      return comparePrimitive(value, filter.value) >= 0;
    case "le":
      return comparePrimitive(value, filter.value) <= 0;
    case "contains":
      return String(value ?? "").toLowerCase().includes(String(filter.value).toLowerCase());
    case "startswith":
      return String(value ?? "").toLowerCase().startsWith(String(filter.value).toLowerCase());
    case "in": {
      if (!Array.isArray(filter.value)) return false;
      return filter.value.some((candidate: string | number) => candidate === value);
    }
    default:
      return false;
  }
}

export function applyFilters(rows: JsonRecord[], filters: ReportFilter[]): JsonRecord[] {
  if (!filters.length) return rows;

  return rows.filter((row) => {
    let include = matchFilter(row, filters[0]);

    for (let i = 1; i < filters.length; i += 1) {
      const filter = filters[i];
      const current = matchFilter(row, filter);
      include = filter.conjunction === "or" ? include || current : include && current;
    }

    return include;
  });
}

export function applySorts(rows: JsonRecord[], sorts: ReportSort[]): JsonRecord[] {
  if (!sorts.length) return rows;

  return [...rows].sort((a, b) => {
    for (const sort of sorts) {
      const cmp = comparePrimitive(readValue(a, sort.field), readValue(b, sort.field));
      if (cmp !== 0) {
        return sort.direction === "desc" ? -cmp : cmp;
      }
    }
    return 0;
  });
}

function toIsoWeekLabel(raw: unknown): string {
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    return "invalid-week";
  }

  const utc = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((utc.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function toMonthLabel(raw: unknown): string {
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) {
    return "invalid-month";
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function applyGroupings(rows: JsonRecord[], groupings: ReportGrouping[]): JsonRecord[] {
  if (!groupings.length) return rows;

  let output = rows;

  for (const grouping of groupings) {
    if (grouping.bucket === "none") continue;

    const map = new Map<string, number>();

    for (const row of output) {
      const rawGroupValue = readValue(row, grouping.field);
      const key =
        grouping.bucket === "week"
          ? toIsoWeekLabel(rawGroupValue)
          : toMonthLabel(rawGroupValue);

      const current = map.get(key) ?? 0;

      if (grouping.aggregate === "count") {
        map.set(key, current + 1);
      } else {
        const numericValue = Number(readValue(row, grouping.aggregateField ?? grouping.field) ?? 0);
        map.set(key, current + (Number.isFinite(numericValue) ? numericValue : 0));
      }
    }

    output = Array.from(map.entries()).map(([bucket, value]) => ({
      bucket,
      [grouping.alias]: value,
    }));
  }

  return output;
}

export function selectColumns(rows: JsonRecord[], columns: ReportColumn[]): JsonRecord[] {
  const visibleColumns = columns.filter((column) => column.visible);
  if (!visibleColumns.length) return rows;

  return rows.map((row) => {
    const selected: JsonRecord = {};
    for (const column of visibleColumns) {
      selected[column.label || column.field] = readValue(row, column.field);
    }
    return selected;
  });
}
