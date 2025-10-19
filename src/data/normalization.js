export const cleanLabel = (value) => {
  if (typeof value !== "string") return value ?? "";
  const base = value.includes(".") ? value.split(".").pop() : value;
  const spaced = base.replace(/[_-]+/g, " ").trim();
  if (!spaced) return "";
  return spaced
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const normalizeExternalRow = (row) => {
  if (!row || typeof row !== "object") return null;

  const mileageUnitRaw =
    typeof row.detail_mileage_unit === "string"
      ? row.detail_mileage_unit.trim().toLowerCase()
      : typeof row.mileage_unit === "string"
        ? row.mileage_unit.trim().toLowerCase()
        : "";

  const mileageValueRaw = row.detail_mileage_value ?? row.mileage_value;
  const mileageNumeric = Number(mileageValueRaw);
  let kilometers = null;

  if (Number.isFinite(mileageNumeric)) {
    if (mileageUnitRaw.startsWith("kmt")) {
      kilometers = mileageNumeric * 1000;
    } else if (mileageUnitRaw.startsWith("km")) {
      kilometers = mileageNumeric;
    } else if (mileageUnitRaw.startsWith("mi")) {
      kilometers = Math.round(mileageNumeric * 1.60934);
    } else {
      kilometers = mileageNumeric;
    }
  }

  const createdAt = row.created_at || row.created_at_iso || row.createdAt;
  const make = cleanLabel(row.make || row.detail_make);
  const model = cleanLabel(row.model || row.detail_model);
  const bodyType = (() => {
    if (typeof row.detail_body_type !== "string") return cleanLabel(row.detail_body_type);
    const base = row.detail_body_type.split(".").pop();
    const label = cleanLabel(base);
    return label.length <= 4 ? label.toUpperCase() : label;
  })();

  return {
    ...row,
    price: row.price ?? row.detail_offer_price ?? row.price_total,
    details_make: make,
    details_model: model,
    details_year: row.detail_vehicle_model_date || row.year,
    details_transmission: row.detail_vehicle_transmission || row.transmission,
    details_body_type: bodyType,
    details_drive_wheel_configuration: row.detail_drive_wheel_configuration || row.drive_configuration,
    details_kilometers: kilometers ?? row.detail_mileage_value,
    details_mileage_unit: kilometers != null ? "km" : row.detail_mileage_unit || row.mileage_unit || "km",
    details_color: cleanLabel(row.detail_color || row.color),
    details_regional_specs: row.regionalSpecs ? row.regionalSpecs.toUpperCase() : row.details_regional_specs,
    details_seller_type: cleanLabel(row.listingType || row.details_seller_type),
    url: row.detail_url || row.detail_item_url || row.url,
    permalink: row.detail_item_url || row.permalink,
    title_en: row.detail_name || row.title_en,
    created_at: createdAt,
    created_at_iso: row.created_at_iso || createdAt,
    city_inferred: cleanLabel(row.city || row.city_inferred),
    area_inferred: cleanLabel(row.area || row.area_inferred),
    source: row.source || "secondary",
  };
};
