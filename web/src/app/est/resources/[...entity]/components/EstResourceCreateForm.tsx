"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  EstSchema,
  FieldErrors,
  formatEnumOption,
  formatFieldLabel,
  getEnumOptions,
  getSchemaProperty,
  getFieldHint,
  isReadOnlyKey,
  isSchemaRequired,
  parseFieldValue,
  validateFieldValue,
} from "@/app/est/resources/[...entity]/components/estResourceFormUtils";

type Props = {
  entity: string;
};

type CreatePayload = Record<string, string | boolean | number | null>;

type SchemaProperty = {
  type?: string;
  enum?: Array<string | number | boolean>;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};

function inferInputType(property: SchemaProperty, key: string) {
  if (property?.enum) return "select";
  if (property?.type === "boolean") return "checkbox";
  if (property?.type === "number" || property?.type === "integer") return "number";
  if (typeof key === "string" && key.toLowerCase().includes("date")) return "date";
  return "text";
}

export default function EstResourceCreateForm({ entity }: Props) {
  const router = useRouter();
  const [schema, setSchema] = useState<EstSchema>(null);
  const [fields, setFields] = useState<Record<string, string | boolean>>({});
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const entityPath = useMemo(() => entity.split("/").map(encodeURIComponent).join("/"), [entity]);

  const propertyKeys = useMemo<string[]>(() => {
    if (!schema?.properties) return [];
    return Object.keys(schema.properties).filter((key) => !isReadOnlyKey(key));
  }, [schema]);

  useEffect(() => {
    async function loadSchema() {
      try {
        setLoading(true);
        const response = await fetch(`/api/est/resources/${entityPath}/schema`);
        if (!response.ok) {
          throw new Error(`Failed to load schema (${response.status})`);
        }
        const data = await response.json();
        const loadedSchema: EstSchema = data?.schema ?? data;
        setSchema(loadedSchema);

        const initialFields: Record<string, string | boolean> = {};
        for (const key of Object.keys(loadedSchema?.properties ?? {})) {
          if (isReadOnlyKey(key)) continue;
          initialFields[key] = "";
        }
        setFields(initialFields);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }

    loadSchema();
  }, [entityPath]);

  const handleFieldChange = (key: string, value: string | boolean) => {
    setFields((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const validateFields = () => {
    const errors: FieldErrors = {};

    for (const key of propertyKeys) {
      const originalValue = "";
      const fieldValue = fields[key];
      const fieldError = validateFieldValue(key, fieldValue, originalValue, schema, entity);
      if (fieldError) {
        errors[key] = fieldError;
      }
    }

    return errors;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const validationErrors = validateFields();
    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);
      setError("Fix validation issues before saving.");
      return;
    }

    setSaving(true);

    try {
      const payload: CreatePayload = {};
      for (const key of propertyKeys) {
        const rawValue = fields[key];
        const schemaProperty = getSchemaProperty(key, schema);
        const originalValue = schemaProperty?.type === "boolean"
          ? false
          : schemaProperty?.type === "number" || schemaProperty?.type === "integer"
          ? 0
          : "";

        payload[key] = parseFieldValue(originalValue, rawValue);
      }

      const response = await fetch(`/api/est/resources/${entityPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Create failed: ${response.status} ${body}`);
      }

      const data = await response.json();
      setSuccess("Item created successfully.");
      const createdObjectId = String(data?.result?.Item?.ObjectID ?? data?.result?.ObjectID ?? data?.ObjectID ?? "");
      if (createdObjectId) {
        router.push(`/est/resources/${entityPath}/edit/${encodeURIComponent(createdObjectId)}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-600">Loading schema...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!schema || propertyKeys.length === 0) {
    return <p className="text-sm text-slate-600">No editable schema fields are available for this entity.</p>;
  }

  return (
    <div className="space-y-6">
      {success && <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}
      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          {propertyKeys.map((key) => {
            const schemaProperty = getSchemaProperty(key, schema);
            const value = fields[key];
            const enumOptions = getEnumOptions(key, schema);
            const inputType = inferInputType(schemaProperty, key);
            const fieldError = fieldErrors[key];

            return (
              <div key={key} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="block text-sm font-medium text-slate-900">
                  {formatFieldLabel(key, schema)}
                  {isSchemaRequired(key, schema) && <span className="ml-1 text-rose-500">*</span>}
                </label>
                {schemaProperty?.description && (
                  <p className="text-xs text-slate-500">{getFieldHint(key, schema)}</p>
                )}
                {enumOptions.length > 0 ? (
                  <select
                    value={String(value ?? "")}
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
                ) : inputType === "checkbox" ? (
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(value)}
                      onChange={(event) => handleFieldChange(key, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-cyan-700"
                    />
                    {String(Boolean(value))}
                  </label>
                ) : (
                  <input
                    type={inputType}
                    value={String(value ?? "")}
                    onChange={(event) => handleFieldChange(key, event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-100"
                  />
                )}
                {fieldError && <p className="text-xs text-rose-700">{fieldError}</p>}
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-cyan-800 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-cyan-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Creating..." : "Create Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
