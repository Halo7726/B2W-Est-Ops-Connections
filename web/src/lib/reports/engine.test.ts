import { describe, expect, it } from "vitest";
import { applyFilters, applyGroupings } from "@/lib/reports/engine";
import type { ReportFilter, ReportGrouping } from "@/lib/reports/types";

describe("report engine strict behavior", () => {
  it("supports strict numeric comparisons", () => {
    const rows = [{ qty: "10" }, { qty: 5 }, { qty: "bad" }];
    const filters: ReportFilter[] = [
      { field: "qty", operator: "gt", value: 6, conjunction: "and" },
    ];

    const filtered = applyFilters(rows, filters);
    expect(filtered).toEqual([{ qty: "10" }]);
  });

  it("supports strict date comparisons", () => {
    const rows = [
      { date: "2026-04-01" },
      { date: "2026-04-10" },
      { date: "bad-date" },
    ];
    const filters: ReportFilter[] = [
      { field: "date", operator: "ge", value: "2026-04-05", conjunction: "and" },
    ];

    const filtered = applyFilters(rows, filters);
    expect(filtered).toEqual([{ date: "2026-04-10" }]);
  });

  it("skips non-numeric values in sum groupings", () => {
    const rows = [
      { day: "2026-04-01", qty: 2 },
      { day: "2026-04-01", qty: "3" },
      { day: "2026-04-01", qty: "x" },
    ];

    const groupings: ReportGrouping[] = [
      {
        field: "day",
        bucket: "month",
        aggregate: "sum",
        aggregateField: "qty",
        alias: "total_qty",
      },
    ];

    const grouped = applyGroupings(rows, groupings);
    expect(grouped).toEqual([{ bucket: "2026-04", total_qty: 5 }]);
  });
});
