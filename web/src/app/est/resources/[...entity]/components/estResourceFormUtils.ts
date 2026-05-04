export type ItemData = Record<string, unknown>;

export type EstSchema = {
  required?: string[];
  properties?: Record<
    string,
    {
      type?: string;
      title?: string;
      description?: string;
      enum?: Array<string | number | boolean>;
      maxLength?: number;
      minimum?: number;
      maximum?: number;
    }
  >;
} | null;

export type FieldErrors = Record<string, string>;

export function isReadOnlyKey(key: string) {
  return key === "ObjectID" || key === "AntiTamperToken";
}

export function getSchemaProperty(key: string, schema: EstSchema) {
  return schema?.properties?.[key] ?? null;
}

export function getEnumOptions(key: string, schema: EstSchema) {
  const property = getSchemaProperty(key, schema);
  return Array.isArray(property?.enum) ? property.enum.map(String) : [];
}

export function formatEnumOption(value: string | number | boolean) {
  if (typeof value === "boolean") return String(value);
  if (typeof value === "number") return String(value);
  return toTitleCase(String(value).replace(/_/g, " "));
}

export function isSchemaRequired(key: string, schema: EstSchema) {
  return Array.isArray(schema?.required) && schema.required.includes(key);
}

export function getFieldHint(key: string, schema: EstSchema) {
  const property = getSchemaProperty(key, schema);
  return property?.description ? toTitleCase(String(property.description)) : undefined;
}

export function formatFieldLabel(key: string, schema: EstSchema) {
  const property = getSchemaProperty(key, schema);
  const raw = property?.title ?? key;
  return toTitleCase(String(raw));
}

export function toTitleCase(input: string) {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export function getItemDisplayTitle(item: ItemData) {
  const labelKeys = ["Name", "Title", "Description", "Category", "Subcategory", "JobCostIDCode", "Code"];
  for (const key of labelKeys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return String(item.ObjectID ?? item.objectId ?? item.id ?? "Untitled item");
}

export function getItemDisplaySubtitle(item: ItemData) {
  const parts: string[] = [];
  const category = item.Category ?? item.CategoryName ?? item.CategoryCode;
  const subcategory = item.Subcategory ?? item.SubCategory ?? item.SubcategoryCode;
  const costPer = item.CostPer ?? item.UnitOfMeasure ?? item.MetricUnitOfMeasure ?? item.ImperialUnitOfMeasure;

  if (typeof category === "string" && category.trim()) parts.push(category);
  if (typeof subcategory === "string" && subcategory.trim()) parts.push(subcategory);
  if (typeof costPer === "string" && costPer.trim()) parts.push(costPer);

  return parts.join(" · ");
}

export function getEntityValidationMessage(
  key: string,
  entity: string,
  value: string | boolean,
  originalValue: unknown
): string | null {
  const normalized = String(value).trim();
  const isEmpty = normalized === "";
  const isNumberField = typeof originalValue === "number" || [
    "BaseCost",
    "Burden",
    "FuelConsumptionRate",
    "HoursPerMonth",
    "HoursPerWeek",
    "OvertimeAfter",
    "OvertimeFactor",
    "QuantityRoundingIncrement",
    "WorkHoursPerDay",
    "DaysPerMonth",
    "DaysPerWeek",
    "WeeksPerMonth",
  ].includes(key);

  if (entity.endsWith("/Laborer")) {
    if (["LaborRateClassREF", "LaborTypeREF", "CostPer"].includes(key) && isEmpty) {
      return "Required field.";
    }
  }

  if (entity.endsWith("/Equipment")) {
    if (["EquipmentRateClassREF", "EquipmentTypeREF", "CostPer"].includes(key) && isEmpty) {
      return "Required field.";
    }
  }

  if (entity.endsWith("/Material")) {
    if (["Name", "ImperialUnitOfMeasure", "MetricUnitOfMeasure", "JobCostIDCode"].includes(key) && isEmpty) {
      return "Required field.";
    }
  }

  if (isNumberField && !isEmpty) {
    const parsed = Number(normalized);
    if (Number.isNaN(parsed)) return "Must be a number.";
    if (parsed < 0) return "Must be 0 or greater.";
  }

  return null;
}

export function validateFieldValue(
  key: string,
  value: string | boolean,
  originalValue: unknown,
  schema: EstSchema,
  entity: string
): string | null {
  if (isReadOnlyKey(key)) {
    return null;
  }

  const schemaProperty = getSchemaProperty(key, schema);
  const rawValue = typeof value === "boolean" ? String(value) : String(value).trim();
  const hasValue = rawValue !== "";

  if (schemaProperty?.enum && hasValue && !schemaProperty.enum.map(String).includes(rawValue)) {
    return `Must be one of: ${schemaProperty.enum.map(String).join(", ")}.`;
  }

  if (isSchemaRequired(key, schema) && !hasValue) {
    return "Required field.";
  }

  if (schemaProperty?.type === "number" || typeof originalValue === "number") {
    if (!hasValue) {
      return isSchemaRequired(key, schema) ? "Required numeric value." : null;
    }

    const parsed = Number(rawValue);
    if (Number.isNaN(parsed)) {
      return "Must be a number.";
    }

    if (typeof schemaProperty?.minimum === "number" && parsed < schemaProperty.minimum) {
      return `Must be at least ${schemaProperty.minimum}.`;
    }

    if (typeof schemaProperty?.maximum === "number" && parsed > schemaProperty.maximum) {
      return `Must be at most ${schemaProperty.maximum}.`;
    }
  }

  if (schemaProperty?.type === "string" && schemaProperty?.maxLength && rawValue.length > schemaProperty.maxLength) {
    return `Must be ${schemaProperty.maxLength} characters or fewer.`;
  }

  return getEntityValidationMessage(key, entity, value, originalValue);
}

export function getFieldDisplayValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean" || typeof value === "number" || typeof value === "string") {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

export function isLongText(value: unknown): boolean {
  return typeof value === "string" && value.length > 80;
}

export function parseFieldValue(originalValue: unknown, editedValue: string | boolean): unknown {
  if (typeof originalValue === "boolean") {
    return Boolean(editedValue);
  }

  if (typeof originalValue === "number") {
    const parsed = Number(editedValue);
    return Number.isNaN(parsed) ? originalValue : parsed;
  }

  if (typeof originalValue === "string") {
    return String(editedValue);
  }

  if (originalValue === null || originalValue === undefined) {
    return editedValue;
  }

  try {
    return JSON.parse(String(editedValue));
  } catch {
    return originalValue;
  }
}
