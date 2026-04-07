import {
  type ReportColumn,
  type ReportFilter,
  type ReportGrouping,
  type ReportSort,
} from "@/lib/reports/types";
import {
  normalizeDateString,
  normalizeNumberStrict,
  normalizeString,
} from "@/lib/reports/transform";

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

function compareStrict(left: unknown, right: unknown): number | null {
  if (left === right) return 0;
  if (left == null || right == null) return null;

  const leftNum = normalizeNumberStrict(left);
  const rightNum = normalizeNumberStrict(right);
  if (leftNum !== null && rightNum !== null) {
    return leftNum - rightNum;
  }

  const leftDate = normalizeDateString(left);
  const rightDate = normalizeDateString(right);
  if (leftDate && rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  if (typeof left === "string" && typeof right === "string") {
    return left.localeCompare(right);
  }

  return null;
}

function compareOrdered(left: unknown, right: unknown): number | null {
  if (left == null || right == null) return null;

  const leftNum = normalizeNumberStrict(left);
  const rightNum = normalizeNumberStrict(right);
  if (leftNum !== null && rightNum !== null) {
    return leftNum - rightNum;
  }

  const leftDate = normalizeDateString(left);
  const rightDate = normalizeDateString(right);
  if (leftDate && rightDate) {
    return leftDate.localeCompare(rightDate);
  }

  return null;
}

function matchFilter(row: JsonRecord, filter: ReportFilter): boolean {
  const value = readValue(row, filter.field);

  switch (filter.operator) {
    case "eq":
      return value === filter.value;
    case "ne":
      return value !== filter.value;
    case "gt": {
      const cmp = compareOrdered(value, filter.value);
      return cmp !== null && cmp > 0;
    }
    case "lt": {
      const cmp = compareOrdered(value, filter.value);
      return cmp !== null && cmp < 0;
    }
    case "ge": {
      const cmp = compareOrdered(value, filter.value);
      return cmp !== null && cmp >= 0;
    }
    case "le": {
      const cmp = compareOrdered(value, filter.value);
      return cmp !== null && cmp <= 0;
    }
    case "contains":
      return normalizeString(value).toLowerCase().includes(normalizeString(filter.value).toLowerCase());
    case "startswith":
      return normalizeString(value).toLowerCase().startsWith(normalizeString(filter.value).toLowerCase());
    case "in": {
      if (!Array.isArray(filter.value)) return false;
      return filter.value.some((candidate: string | number) => {
        if (candidate === value) return true;
        const cmp = compareStrict(value, candidate);
        return cmp === 0;
      });
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
        const numericValue = normalizeNumberStrict(readValue(row, grouping.aggregateField ?? grouping.field));
        if (numericValue === null) {
          continue;
        }
        map.set(key, current + numericValue);
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
