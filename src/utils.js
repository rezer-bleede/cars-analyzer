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
