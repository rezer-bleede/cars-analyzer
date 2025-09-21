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
