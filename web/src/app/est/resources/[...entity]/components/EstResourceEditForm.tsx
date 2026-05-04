"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  EstSchema,
  FieldErrors,
  ItemData,
  formatEnumOption,
  formatFieldLabel,
  getEnumOptions,
  getFieldDisplayValue,
  getFieldHint,
  getSchemaProperty,
  isLongText,
  isReadOnlyKey,
  isSchemaRequired,
  parseFieldValue,
  validateFieldValue,
} from "@/app/est/resources/[...entity]/components/estResourceFormUtils";

type Props = {
  entity: string;
  objectId: string;
};

type FieldInfo = {
  key: string;
  value: unknown;
  editable: boolean;
};

export default function EstResourceEditForm({ entity, objectId }: Props) {
  const [item, setItem] = useState<ItemData | null>(null);
  const [fields, setFields] = useState<Record<string, string | boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [schema, setSchema] = useState<EstSchema>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fieldInfos = useMemo<FieldInfo[]>(() => {
    if (!item) return [];
    return Object.entries(item).map(([key, value]) => ({
      key,
      value,
      editable: !isReadOnlyKey(key),
    }));
  }, [item]);

  useEffect(() => {
    async function loadItem() {
      try {
        setLoading(true);
        const filter = encodeURIComponent(`ObjectID eq '${objectId}'`);
        const entityPath = entity.split("/").map(encodeURIComponent).join("/");
        const response = await fetch(`/api/est/resources/${entityPath}?filter=${filter}&top=1`);

        if (!response.ok) {
          throw new Error(`Failed to load item: ${response.status}`);
        }

        const data = await response.json();
        const items = Array.isArray(data.items) ? data.items : [];
        const fetchedItem = items[0] ?? null;

        if (!fetchedItem) {
          throw new Error("Item not found");
        }

        setItem(fetchedItem as ItemData);
        const initialFields: Record<string, string | boolean> = {};

        for (const [key, value] of Object.entries(fetchedItem)) {
          if (typeof value === "boolean") {
            initialFields[key] = value;
          } else if (typeof value === "number") {
            initialFields[key] = String(value);
          } else if (typeof value === "string") {
            initialFields[key] = value;
          } else {
            initialFields[key] = JSON.stringify(value ?? null, null, 2);
          }
        }

        setFields(initialFields);

        const schemaResponse = await fetch(`/api/est/resources/${entityPath}/schema`);
        if (schemaResponse.ok) {
          const schemaData = await schemaResponse.json();
          setSchema(schemaData?.schema ?? schemaData);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadItem();
  }, [entity, objectId]);

  const handleFieldChange = (key: string, value: string | boolean) => {
    setFields((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validateFields = (itemData: ItemData) => {
    const errors: FieldErrors = {};

    for (const [key, originalValue] of Object.entries(itemData)) {
      if (isReadOnlyKey(key) || !(key in fields)) {
        continue;
      }

      const fieldError = validateFieldValue(key, fields[key], originalValue, schema, entity);
      if (fieldError) {
        errors[key] = fieldError;
      }
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!item) return;

    const validationErrors = validateFields(item);
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Fix validation issues before saving.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {};

      for (const [key, originalValue] of Object.entries(item)) {
        if (key in fields) {
          payload[key] = parseFieldValue(originalValue, fields[key]);
        } else {
          payload[key] = originalValue;
        }
      }

      const entityPath = entity.split("/").map(encodeURIComponent).join("/");
      const response = await fetch(`/api/est/resources/${entityPath}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Save failed: ${response.status} ${body}`);
      }

      setSuccess("Saved successfully.");
      const updated = await response.json();
      if (updated?.result?.Item) {
        setItem(updated.result.Item as ItemData);
      }
      setFieldErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Loading resource details...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!item) {
    return <p className="text-sm text-slate-600">No item loaded.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {fieldInfos.map(({ key, value, editable }) => {
          const fieldValue = getFieldDisplayValue(value);
          const booleanValue = typeof value === "boolean" ? Boolean(fields[key]) : false;
          const isReadOnly = !editable;
          const longText = isLongText(value);
          const schemaProperty = getSchemaProperty(key, schema);

          return (
            <div key={key} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <label className="block text-sm font-medium text-slate-900">{formatFieldLabel(key, schema)}</label>
              {schemaProperty?.description && (
                <p className="text-xs text-slate-500">{getFieldHint(key, schema)}</p>
              )}
              {typeof value === "boolean" ? (
                <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={booleanValue}
                    disabled={isReadOnly}
                    onChange={(event) => handleFieldChange(key, event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-cyan-700"
                  />
                  {String(booleanValue)}
                </label>
              ) : longText ? (
                <textarea
                  readOnly={isReadOnly}
                  value={String(fields[key] ?? "")}
                  onChange={(event) => handleFieldChange(key, event.target.value)}
                  className="min-h-[120px] w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              ) : typeof value === "number" ? (
                <input
                  type="number"
                  value={String(fields[key] ?? "")}
                  readOnly={isReadOnly}
                  onChange={(event) => handleFieldChange(key, event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                />
              ) : (() => {
                const enumOptions = getEnumOptions(key, schema);
                if (enumOptions.length > 0 && !isReadOnly) {
                  return (
                    <select
                      value={String(fields[key] ?? "")}
                      onChange={(event) => handleFieldChange(key, event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    >
                      <option value="">Select value...</option>
                      {enumOptions.map((option) => (
                        <option key={option} value={option}>
                          {formatEnumOption(option)}
                        </option>
                      ))}
                    </select>
                  );
                }

                if (typeof value === "string") {
                  return (
                    <input
                      type="text"
                      value={String(fields[key] ?? "")}
                      readOnly={isReadOnly}
                      onChange={(event) => handleFieldChange(key, event.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                    />
                  );
                }

                return (
                  <textarea
                    readOnly
                    value={fieldValue ?? ""}
                    className="min-h-[120px] w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700 shadow-sm"
                  />
                );
              })()}
              {fieldErrors[key] && (
                <p className="text-xs text-rose-700">{fieldErrors[key]}</p>
              )}
              {isReadOnly && <p className="text-xs text-slate-500">Read-only field preserved for update.</p>}
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          {success && <p className="text-sm text-emerald-700">{success}</p>}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-cyan-800 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {saving ? "Saving..." : "Save Resource"}
        </button>
      </div>
    </form>
  );
}
