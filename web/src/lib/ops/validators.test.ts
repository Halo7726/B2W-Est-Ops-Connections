import { describe, expect, it } from "vitest";
import { extractOpsRows } from "@/lib/ops/validators";

describe("extractOpsRows", () => {
  it("accepts a raw array payload", () => {
    const rows = extractOpsRows([{ id: 1 }, { id: 2 }]);
    expect(rows).toHaveLength(2);
  });

  it("accepts value wrapper payload", () => {
    const rows = extractOpsRows({ value: [{ id: 1 }] });
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("accepts Items wrapper payload", () => {
    const rows = extractOpsRows({ Pagination: { TotalItems: 1 }, Items: [{ id: 1 }] });
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("accepts lowercase items wrapper payload", () => {
    const rows = extractOpsRows({ items: [{ id: 1 }] });
    expect(rows).toEqual([{ id: 1 }]);
  });

  it("throws for unsupported payload shape", () => {
    expect(() => extractOpsRows({ data: { id: 1 } })).toThrow(
      /did not include rows in array\/value\/Items\/items/i
    );
  });
});
