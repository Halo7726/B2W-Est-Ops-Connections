type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

function isObjectArray(value: unknown): value is JsonObject[] {
  return Array.isArray(value) && value.every((item) => isObject(item));
}

export function extractOpsRows(payload: unknown): JsonObject[] {
  if (isObjectArray(payload)) {
    return payload;
  }

  if (!isObject(payload)) {
    throw new Error("OPS response payload is not an object or array");
  }

  if (isObjectArray(payload.value)) {
    return payload.value;
  }

  if (isObjectArray(payload.Items)) {
    return payload.Items;
  }

  if (isObjectArray(payload.items)) {
    return payload.items;
  }

  throw new Error("OPS response did not include rows in array/value/Items/items format");
}
