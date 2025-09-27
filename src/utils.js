export const uniq = (arr) => [...new Set(arr)];
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const cmp = (a, b) => {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return (a > b) - (a < b);
};

export const fmtPrice = (v) => (v == null ? "" : `AED ${Number(v).toLocaleString("en-US")}`);
export const fmtKM = (v) => (v == null ? "" : `${Number(v).toLocaleString("en-US")} km`);

export const groupBy = (arr, keyFn) =>
  arr.reduce((m, x) => {
    const k = keyFn(x);
    (m[k] = m[k] || []).push(x);
    return m;
  }, {});

export const safeAvg = (xs) => {
  const vals = xs.map(Number).filter((v) => Number.isFinite(v));
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
};

const textParts = (value) => {
  if (value == null) return [];
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return [String(value)];
  }
  if (Array.isArray(value)) {
    return value.flatMap(textParts);
  }
  if (typeof value === "object") {
    const candidates = [];
    const favoredKeys = [
      "full",
      "name",
      "label",
      "value",
      "text",
      "title",
      "display"
    ];
    for (const key of favoredKeys) {
      if (key in value) candidates.push(value[key]);
    }
    if ("path" in value) candidates.push(value.path);
    if ("hierarchy" in value) candidates.push(value.hierarchy);
    if ("values" in value) candidates.push(value.values);
    if ("parts" in value) candidates.push(value.parts);
    if (value.city || value.area) candidates.push([value.city, value.area]);
    return candidates.flatMap(textParts);
  }
  return [];
};

const dedupeParts = (parts) => {
  const seen = new Set();
  const out = [];
  for (const part of parts) {
    if (!part) continue;
    const normalized = part.replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
};

const pickText = (row, selectors, { joiner = " " } = {}) => {
  for (const selector of selectors) {
    const raw = typeof selector === "function" ? selector(row) : row?.[selector];
    const parts = dedupeParts(textParts(raw));
    if (parts.length) return joiner === false ? parts[0] : parts.join(joiner);
  }
  return "";
};

const brandSelectors = [
  "brand",
  "details_make",
  "details_brand",
  "details_make_name",
  "make",
  "make_name",
  "vehicle_make",
  "meta_make",
  "listing_make",
  (row) => row?.details?.make,
  (row) => row?.details?.brand
];

const modelSelectors = [
  "model",
  "details_model",
  "details_model_trim",
  "details_model_name",
  "details_trim",
  "details_variant",
  "model_name",
  "model_trim",
  "vehicle_model",
  "meta_model",
  "listing_model",
  (row) => row?.details?.model,
  (row) => row?.details?.trim
];

const locationSelectors = [
  "location_full",
  "full_location",
  "listing_location",
  "location_text",
  "location_name",
  "meta_location",
  "details_location",
  "address",
  "address_full",
  (row) => row?.location?.full,
  (row) => row?.location?.name,
  (row) => row?.location?.label,
  (row) => row?.location?.text,
  (row) => row?.location?.display,
  (row) => row?.location?.path,
  (row) => row?.location?.hierarchy,
  "location_path",
  "location_hierarchy",
  "location_segments",
  "location_parts",
  "location_values",
  (row) => [row?.city_inferred, row?.neighbourhood_en, row?.area_inferred || row?.details_area || row?.area],
  "city_inferred"
];

export const deriveBrand = (row) => pickText(row, brandSelectors, { joiner: " " });
export const deriveModel = (row) => pickText(row, modelSelectors, { joiner: " " });
export const deriveFullLocation = (row) => pickText(row, locationSelectors, { joiner: " -> " });

/** Parse any common timestamp representation to epoch ms (number) */
export const toEpochMs = (v) => {
  if (v == null) return null;
  if (typeof v === "number") {
    // assume seconds if < 1e12
    return v < 1e12 ? Math.round(v * 1000) : Math.round(v);
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{13}$/.test(s)) return Number(s);
    if (/^\d{10}$/.test(s)) return Number(s) * 1000;
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
  }
  return null;
};

/** Normalize any reasonable timestamp fields into {ms, iso} */
export const normalizeTimestamp = (row, candidates = [
  "created_at_epoch_ms",
  "created_at_epoch",
  "created_at_epoch_iso",
  "added_epoch_iso",
  "created_at",
  "scraped_at",
  "timestamp",
  "time",
  "listed_at"
]) => {
  for (const k of candidates) {
    if (row[k] != null) {
      const ms = toEpochMs(row[k]);
      if (Number.isFinite(ms)) {
        return { ms, iso: new Date(ms).toISOString() };
      }
    }
  }
  return { ms: null, iso: "" };
};
