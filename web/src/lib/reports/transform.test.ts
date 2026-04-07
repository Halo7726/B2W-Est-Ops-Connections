import { describe, expect, it } from "vitest";
import {
  normalizeBoolean,
  normalizeDateString,
  normalizeNumberStrict,
  normalizeString,
  parseCachedJsonStrict,
} from "@/lib/reports/transform";

describe("report transform helpers", () => {
  it("normalizes strings safely", () => {
    expect(normalizeString("  ABC  ")).toBe("ABC");
    expect(normalizeString(null)).toBe("");
    expect(normalizeString(42)).toBe("42");
  });

  it("normalizes booleans from strict values", () => {
    expect(normalizeBoolean(true)).toBe(true);
    expect(normalizeBoolean("1")).toBe(true);
    expect(normalizeBoolean("false")).toBe(false);
    expect(normalizeBoolean("not-bool")).toBeNull();
  });

  it("normalizes numbers strictly", () => {
    expect(normalizeNumberStrict(42)).toBe(42);
    expect(normalizeNumberStrict(" 3.14 ")).toBe(3.14);
    expect(normalizeNumberStrict("nope")).toBeNull();
    expect(normalizeNumberStrict(undefined)).toBeNull();
  });

  it("normalizes valid dates to yyyy-mm-dd", () => {
    expect(normalizeDateString("2026-04-07T20:00:00.000Z")).toBe("2026-04-07");
    expect(normalizeDateString("invalid")).toBeNull();
  });

  it("parses cached JSON strictly", () => {
    expect(parseCachedJsonStrict('{"a":1}')).toEqual({ a: 1 });
    expect(parseCachedJsonStrict("[]")).toBeNull();
    expect(parseCachedJsonStrict("not json")).toBeNull();
  });
});
