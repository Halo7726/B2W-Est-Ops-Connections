import { z } from "zod";

export const filterOperatorSchema = z.enum([
  "eq",
  "ne",
  "gt",
  "lt",
  "ge",
  "le",
  "contains",
  "startswith",
  "in",
]);

export const conjunctionSchema = z.enum(["and", "or"]);

export const reportFilterSchema = z.object({
  field: z.string().min(1),
  operator: filterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.array(z.number())]),
  conjunction: conjunctionSchema.default("and"),
});

export const reportSortSchema = z.object({
  field: z.string().min(1),
  direction: z.enum(["asc", "desc"]).default("asc"),
});

export const reportColumnSchema = z.object({
  field: z.string().min(1),
  label: z.string().optional(),
  visible: z.boolean().default(true),
});

export const reportGroupingSchema = z.object({
  field: z.string().min(1),
  bucket: z.enum(["none", "week", "month"]).default("none"),
  aggregate: z.enum(["sum", "count"]).default("count"),
  aggregateField: z.string().optional(),
  alias: z.string().default("value"),
});

export const reportDefinitionInputSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  entity: z.string().min(1),
  filters: z.array(reportFilterSchema).default([]),
  sorts: z.array(reportSortSchema).default([]),
  columns: z.array(reportColumnSchema).default([]),
  groupings: z.array(reportGroupingSchema).default([]),
  isShared: z.boolean().default(false),
});

export type ReportFilter = z.infer<typeof reportFilterSchema>;
export type ReportSort = z.infer<typeof reportSortSchema>;
export type ReportColumn = z.infer<typeof reportColumnSchema>;
export type ReportGrouping = z.infer<typeof reportGroupingSchema>;
export type ReportDefinitionInput = z.infer<typeof reportDefinitionInputSchema>;
