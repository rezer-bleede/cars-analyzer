export const uniq = (arr) => [...new Set(arr)];
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

export const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const normalizeToList = (value) => {
  if (!value && value !== 0) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry)))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || trimmed.startsWith("{")) {
      try {
        return normalizeToList(JSON.parse(trimmed));
      } catch (error) {
        console.warn("Failed to parse JSON list", error);
      }
    }
    return trimmed
      .split(/[\n,]+/)
      .map((segment) => segment.trim())
      .filter(Boolean);
  }
  if (typeof value === "object") {
    return normalizeToList(Object.values(value || {}));
  }
  return [String(value)].filter(Boolean);
};

export const parseUrlList = (value, { allowWindowLookup = false, windowKey } = {}) => {
  if (allowWindowLookup && !value && typeof window !== "undefined" && windowKey) {
    return parseUrlList(window[windowKey]);
  }
  return normalizeToList(value);
};

const candidateArrayKeys = [
  "data",
  "listings",
  "results",
  "items",
  "rows",
  "cars",
  "vehicles",
  "entries",
  "records",
  "payload",
  "response",
  "dataset"
];

const findFirstArray = (value, depth = 0) => {
  if (!value || depth > 3) return [];
  if (Array.isArray(value)) return value;
  if (typeof value !== "object") return [];

  for (const key of candidateArrayKeys) {
    if (Array.isArray(value[key])) {
      return value[key];
    }
  }

  for (const key of candidateArrayKeys) {
    if (value[key] && typeof value[key] === "object") {
      const nested = findFirstArray(value[key], depth + 1);
      if (nested.length) return nested;
    }
  }

  for (const nestedValue of Object.values(value)) {
    if (Array.isArray(nestedValue)) return nestedValue;
  }

  for (const nestedValue of Object.values(value)) {
    if (nestedValue && typeof nestedValue === "object") {
      const nested = findFirstArray(nestedValue, depth + 1);
      if (nested.length) return nested;
    }
  }

  return [];
};

export const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const direct = findFirstArray(payload);
    if (direct.length) return direct;
  }
  return [];
};

const quantile = (sortedValues, q) => {
  const n = sortedValues.length;
  if (!n) return null;
  if (n === 1) return sortedValues[0];
  const pos = (n - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < n) {
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
  }
  return sortedValues[base];
};

export const computeTrimmedAverage = (values, { iqrFactor = 1.5, maxStdDevs = 3 } = {}) => {
  const valid = values.filter((v) => Number.isFinite(v));
  if (!valid.length) return { average: null, count: 0, removed: 0 };
  const sorted = valid.slice().sort((a, b) => a - b);

  let lower = sorted[0];
  let upper = sorted[sorted.length - 1];
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 != null && q1 != null ? q3 - q1 : null;

  if (Number.isFinite(iqr) && iqr > 0) {
    lower = q1 - iqrFactor * iqr;
    upper = q3 + iqrFactor * iqr;
  } else {
    const median = quantile(sorted, 0.5) ?? sorted[Math.floor(sorted.length / 2)];
    const deviations = sorted.map((v) => Math.abs(v - median));
    const mad = quantile(deviations, 0.5);
    if (mad && mad > 0) {
      const scale = mad * 1.4826;
      lower = median - maxStdDevs * scale;
      upper = median + maxStdDevs * scale;
    } else {
      const tolerance = Math.max(500, Math.abs(median) * 0.1);
      lower = median - tolerance;
      upper = median + tolerance;
    }
  }

  let filtered = sorted.filter((v) => v >= lower && v <= upper);
  if (!filtered.length) filtered = sorted;
  const sum = filtered.reduce((acc, v) => acc + v, 0);
  return {
    average: Math.round(sum / filtered.length),
    count: filtered.length,
    removed: sorted.length - filtered.length
  };
};

export const formatRelativeTime = (timestamp, now = Date.now()) => {
  if (!Number.isFinite(timestamp)) return "No timestamp";
  const diffMs = now - timestamp;
  if (diffMs < 0) {
    const aheadMs = Math.abs(diffMs);
    const aheadMinutes = Math.round(aheadMs / (60 * 1000));
    if (aheadMinutes < 60) return `in ${aheadMinutes} min`;
    const aheadHours = Math.round(aheadMinutes / 60);
    if (aheadHours < 48) return `in ${aheadHours} hr`;
    const aheadDays = Math.round(aheadHours / 24);
    return `in ${aheadDays} days`;
  }
  const minutes = Math.round(diffMs / (60 * 1000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 60) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} mo ago`;
  const years = Math.round(months / 12);
  return `${years} yr ago`;
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

// Simple 32-bit string hash -> hex (deterministic, not cryptographic)
export const hash32 = (str) => {
  str = String(str ?? "");
  let h = 0x811c9dc5; // FNV-1a offset basis
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0; // FNV-ish mix
  }
  return ("00000000" + h.toString(16)).slice(-8);
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
