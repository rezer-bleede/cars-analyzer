import { describe, expect, it } from "vitest";
import { cleanLabel, normalizeExternalRow } from "./normalization.js";

describe("cleanLabel", () => {
  it("capitalizes and de-hyphenates labels", () => {
    expect(cleanLabel("mid-size_sedan")).toBe("Mid Size Sedan");
  });

  it("returns empty string for falsy input", () => {
    expect(cleanLabel(null)).toBe("");
  });
});

describe("normalizeExternalRow", () => {
  it("maps external feed fields into dashboard schema", () => {
    const normalized = normalizeExternalRow({
      detail_make: "toyota",
      detail_model: "corolla",
      detail_body_type: "body.suv",
      detail_vehicle_model_date: 2022,
      detail_mileage_unit: "KM",
      detail_mileage_value: 15000,
      detail_offer_price: 55000,
      regionalSpecs: "gcc",
      listingType: "dealer",
      detail_item_url: "https://example.com/car/123",
      detail_name: "Toyota Corolla",
      created_at_iso: "2024-01-01T00:00:00Z",
      city: "abu_dhabi",
    });

    expect(normalized.details_make).toBe("Toyota");
    expect(normalized.details_model).toBe("Corolla");
    expect(normalized.details_body_type).toBe("SUV");
    expect(normalized.details_mileage_unit).toBe("KM");
    expect(normalized.details_kilometers).toBe(15000);
    expect(normalized.price).toBe(55000);
    expect(normalized.details_regional_specs).toBe("GCC");
    expect(normalized.details_seller_type).toBe("Dealer");
    expect(normalized.url).toBe("https://example.com/car/123");
    expect(normalized.title_en).toBe("Toyota Corolla");
    expect(normalized.city_inferred).toBe("Abu Dhabi");
    expect(normalized.source).toBe("secondary");
  });

  it("returns null for invalid rows", () => {
    expect(normalizeExternalRow(null)).toBeNull();
  });
});
