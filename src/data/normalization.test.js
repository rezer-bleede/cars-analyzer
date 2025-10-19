import { describe, expect, it } from "vitest";
import { normalizeExternalRow } from "./normalization.js";

describe("normalizeExternalRow", () => {
  it("normalizes mileage units expressed in thousands of kilometers", () => {
    const row = {
      id: "sample",
      detail_mileage_value: 20,
      detail_mileage_unit: "KMT",
      make: "baic",
      model: "x55",
      detail_vehicle_model_date: "2026",
    };

    const normalized = normalizeExternalRow(row);
    expect(normalized.details_kilometers).toBe(20000);
    expect(normalized.details_mileage_unit).toBe("km");
  });

  it("returns null when the payload is not an object", () => {
    expect(normalizeExternalRow(null)).toBeNull();
    expect(normalizeExternalRow(undefined)).toBeNull();
  });
});

