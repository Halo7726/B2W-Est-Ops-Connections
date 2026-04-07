import type {
  ReportColumn,
  ReportFilter,
  ReportGrouping,
  ReportSort,
} from "@/lib/reports/types";

export interface ReportDefinition {
  id: string;
  name: string;
  description: string | null;
  entity: string;
  filters: ReportFilter[];
  sorts: ReportSort[];
  columns: ReportColumn[];
  groupings: ReportGrouping[];
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ReportRunResult {
  ok: boolean;
  report: {
    id: string;
    name: string;
    entity: string;
  };
  rows: Record<string, unknown>[];
  rowCount: number;
  preview: Record<string, unknown>[];
}
