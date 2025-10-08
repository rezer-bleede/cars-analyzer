import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import SearchMultiSelect from "./components/SearchMultiSelect.jsx";
import Overview from "./pages/Overview.jsx";
import Charts from "./pages/Charts.jsx";
import CarDetail from "./pages/CarDetail.jsx";
import Flippers from "./pages/Flippers.jsx";
import Analytics from "./pages/Analytics.jsx";
import { num, normalizeTimestamp, deriveBrand, deriveModel, deriveFullLocation, hash32 } from "./utils";

const R2_URL =
  import.meta.env.VITE_R2_JSON_URL?.trim() ||
  (typeof window !== "undefined" && window.__R2_JSON_URL__) ||
  "";

const CRSWTCH_URL = import.meta.env.VITE_CRSWTCH_JSON_URL?.trim() || "";

const SEARCH_FIELDS = [
  "details_make",
  "details_model",
  "brand",
  "model",
  "location_full",
  "neighbourhood_en",
  "details_regional_specs",
  "details_seller_type",
  "title_en",
  "city_inferred",
  "details_body_type"
];

const tokenMatcher = /"([^"]+)"|'([^']+)'|[^\s]+/g;

const parseSearchQuery = (input) => {
  if (!input) return [];
  const groups = [];
  for (const segment of input.split(",")) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const tokens = [];
    const matcher = trimmed.matchAll(tokenMatcher);
    for (const match of matcher) {
      const token = (match[1] || match[2] || match[0] || "").trim().toLowerCase();
      if (token) tokens.push(token);
    }
    if (tokens.length) groups.push(tokens);
  }
  return groups;
};

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

const describeDateFilter = (filter, customWeeks) => {
  const now = Date.now();
  switch (filter) {
    case "1d":
      return { label: "Last 1 day", cutoffMs: now - MILLIS_PER_DAY, days: 1 };
    case "3d":
      return { label: "Last 3 days", cutoffMs: now - 3 * MILLIS_PER_DAY, days: 3 };
    case "1w":
      return { label: "Last 1 week", cutoffMs: now - 7 * MILLIS_PER_DAY, days: 7 };
    case "custom": {
      const weeksRaw = Number(customWeeks);
      if (Number.isFinite(weeksRaw) && weeksRaw > 0) {
        const weeks = Math.min(52, Math.max(1, Math.floor(weeksRaw)));
        const days = weeks * 7;
        return {
          label: `Last ${weeks} week${weeks === 1 ? "" : "s"}`,
          cutoffMs: now - days * MILLIS_PER_DAY,
          days
        };
      }
      return { label: "Custom", cutoffMs: null, days: null };
    }
    default:
      return { label: "All dates", cutoffMs: null, days: null };
  }
};

const cleanLabel = (value) => {
  if (typeof value !== "string") return value ?? "";
  const base = value.includes(".") ? value.split(".").pop() : value;
  const spaced = base.replace(/[_-]+/g, " ").trim();
  if (!spaced) return "";
  return spaced
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    for (const key of ["data", "listings", "results", "items", "rows"]) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return [];
};

const normalizeCarswitchRow = (row) => {
  if (!row || typeof row !== "object") return null;

  const mileageUnit = typeof row.detail_mileage_unit === "string" ? row.detail_mileage_unit.toLowerCase() : "";
  const kilometers = mileageUnit.startsWith("km") ? row.detail_mileage_value : null;
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
    details_mileage_unit: row.detail_mileage_unit || row.mileage_unit || "km",
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
    source: row.source || "crswtch",
  };
};

export default function App() {
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [searchTokens, setSearchTokens] = useState([]);
  const [cityFilter, setCityFilter] = useState("");
  const [bodyFilter, setBodyFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [customWeeks, setCustomWeeks] = useState("4");
  const [resetSignal, setResetSignal] = useState(0);

  const cityOptions = useMemo(
    () => [...new Set(data.map((d) => d.city_inferred).filter(Boolean))].sort(),
    [data]
  );
  const bodyOptions = useMemo(
    () => [...new Set(data.map((d) => d.details_body_type).filter(Boolean))].sort(),
    [data]
  );

  const searchSuggestions = useMemo(() => {
    const map = new Map();
    const addValue = (label) => {
      if (label == null) return;
      const trimmed = String(label).trim();
      if (!trimmed) return;
      const normalized = trimmed.toLowerCase();
      const current = map.get(normalized);
      if (current) {
        current.count += 1;
      } else {
        map.set(normalized, { label: trimmed, count: 1 });
      }
    };

    data.forEach((row) => {
      SEARCH_FIELDS.forEach((field) => {
        const raw = row[field];
        if (raw == null) return;
        if (Array.isArray(raw)) {
          raw.forEach(addValue);
        } else if (typeof raw === "string") {
          if (raw.includes("/")) {
            raw.split("/").forEach(addValue);
          } else if (raw.includes(",")) {
            raw.split(",").forEach(addValue);
          } else {
            addValue(raw);
          }
        } else {
          addValue(raw);
        }
      });
    });

    return Array.from(map.values())
      .sort((a, b) => {
        if (b.count === a.count) {
          return a.label.localeCompare(b.label);
        }
        return b.count - a.count;
      })
      .slice(0, 200)
      .map((entry) => entry.label);
  }, [data]);

  useEffect(() => {
    (async () => {
      try {
        if (!R2_URL) throw new Error("R2 JSON URL not set. Set VITE_R2_JSON_URL or window.__R2_JSON_URL__.");
        const fetchJson = async (url, { optional = false } = {}) => {
          if (!url) {
            if (optional) return [];
            throw new Error("JSON URL missing");
          }
          try {
            const res = await fetch(url, { cache: "no-store" });
            if (!res.ok) {
              if (optional) return [];
              throw new Error(`Fetch failed ${res.status}`);
            }
            return res.json();
          } catch (error) {
            if (optional) {
              console.warn(`Optional source failed: ${url}`, error);
              return [];
            }
            throw error;
          }
        };

        const [primaryPayload, carswitchPayload] = await Promise.all([
          fetchJson(R2_URL),
          fetchJson(CRSWTCH_URL, { optional: true })
        ]);

        const baseRows = toArray(primaryPayload);
        const carswitchRows = toArray(carswitchPayload)
          .map(normalizeCarswitchRow)
          .filter(Boolean);

        const rows = [...baseRows, ...carswitchRows];

        rows.forEach((d) => {
          d.price = num(d.price);
          d.details_kilometers = num(d.details_kilometers);
          d.details_year = num(d.details_year);

          d.brand = deriveBrand(d) || "";
          d.model = deriveModel(d) || "";
          d.location_full = deriveFullLocation(d) || "";

          d.details_make = d.details_make || d.brand;
          d.details_model = d.details_model || d.model;

          // Normalize actual timestamp from listings.json (whichever field exists)
          const ts = normalizeTimestamp(d);
          d.created_at_epoch_ms = ts.ms;
          d.created_at_iso = ts.iso;
          d.created_at_day = Number.isFinite(ts.ms) ? new Date(ts.ms).toISOString().slice(0,10) : "";

          // Deterministic uid for internal routing
          const idSource = [
            d.id,
            d.url,
            d.permalink,
            d.created_at_iso,
            d.title_en,
            d.price,
            d.details_make,
            d.details_model,
            d.details_year
          ].filter(Boolean).join("|");
          d.uid = hash32(idSource);
        });

        // Compute market averages for the last 3 months by (brand,model,year)
        const now = Date.now();
        const threeMonthsMs = 90 * 24 * 60 * 60 * 1000; // approx 3 months
        const cutoff = now - threeMonthsMs;

        // Build segment aggregates
        const segMap = new Map(); // key => {sum,count}
        for (const d of rows) {
          if (!Number.isFinite(d.price)) continue;
          if (!Number.isFinite(d.created_at_epoch_ms) || d.created_at_epoch_ms < cutoff) continue;
          const make = d.details_make || d.brand;
          const model = d.details_model || d.model;
          const year = d.details_year;
          if (!make || !model || !Number.isFinite(year)) continue;
          const key = `${make}|${model}|${year}`.toLowerCase();
          const cur = segMap.get(key) || { sum: 0, count: 0 };
          cur.sum += d.price;
          cur.count += 1;
          segMap.set(key, cur);
        }

        // Apply market_avg & market_diff to each row (diff = market_avg - price)
        for (const d of rows) {
          const make = d.details_make || d.brand;
          const model = d.details_model || d.model;
          const year = d.details_year;
          let market_avg = null;
          let market_count = 0;
          if (make && model && Number.isFinite(year)) {
            const key = `${make}|${model}|${year}`.toLowerCase();
            const agg = segMap.get(key);
            if (agg && agg.count > 0) {
              market_avg = Math.round(agg.sum / agg.count);
              market_count = agg.count;
            }
          }
          d.market_avg = market_avg;
          d.market_count = market_count;
          d.market_diff = Number.isFinite(d.price) && Number.isFinite(market_avg)
            ? market_avg - d.price
            : null;
          d.market_discount_pct = Number.isFinite(d.market_diff) && Number.isFinite(market_avg) && market_avg !== 0
            ? (d.market_diff / market_avg) * 100
            : null;

          const blob = SEARCH_FIELDS
            .map((field) => d[field])
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          d._search_blob = blob;
        }

        setData(rows);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const searchGroups = useMemo(
    () => parseSearchQuery(searchTokens.join(", ")),
    [searchTokens]
  );
  const dateFilterMeta = useMemo(() => describeDateFilter(dateFilter, customWeeks), [dateFilter, customWeeks]);

  const filteredData = useMemo(() => {
    const cutoff = dateFilterMeta.cutoffMs;
    return data.filter((d) => {
      if (cityFilter && d.city_inferred !== cityFilter) return false;
      if (bodyFilter && d.details_body_type !== bodyFilter) return false;
      if (cutoff != null) {
        if (!Number.isFinite(d.created_at_epoch_ms)) return false;
        if (d.created_at_epoch_ms < cutoff) return false;
      }
      if (searchGroups.length) {
        const blob = d._search_blob || "";
        const matches = searchGroups.some((tokens) => tokens.every((token) => blob.includes(token)));
        if (!matches) return false;
      }
      return true;
    });
  }, [data, cityFilter, bodyFilter, searchGroups, dateFilterMeta.cutoffMs]);

  const stats = useMemo(() => {
    const totalListings = filteredData.length;
    const avgPrice = totalListings > 0
      ? Math.round(filteredData.reduce((sum, d) => sum + (d.price || 0), 0) / totalListings)
      : 0;
    const cities = new Set(filteredData.map((d) => d.city_inferred).filter(Boolean)).size;
    return { totalListings, avgPrice, cities };
  }, [filteredData]);

  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (err) return <div className="container"><p style={{color:"#b00020"}}>Error: {err}</p></div>;

  const handleReset = () => {
    setSearchTokens([]);
    setCityFilter("");
    setBodyFilter("");
    setDateFilter("all");
    setCustomWeeks("4");
    setResetSignal((n) => n + 1);
  };

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <header className="app-header shadow-sm border-bottom sticky-top" style={{ zIndex: 1030 }}>
        <div className="container-fluid py-3">
          <div className="app-header__grid">
            <div className="app-header__brand">
              <h1 className="h5 mb-1 text-primary fw-bold">🚗 Used Cars Dashboard</h1>
              <p className="text-muted small mb-0">Real-time car listings analysis</p>
            </div>

            <div className="app-header__stats" aria-label="Dataset summary">
              <div>
                <span className="app-header__stat-value text-primary">
                  {stats.totalListings.toLocaleString()}
                </span>
                <span className="app-header__stat-label">Active listings</span>
              </div>
              <div>
                <span className="app-header__stat-value text-success">
                  AED {stats.avgPrice.toLocaleString()}
                </span>
                <span className="app-header__stat-label">Average price</span>
              </div>
              <div>
                <span className="app-header__stat-value text-info">{stats.cities}</span>
                <span className="app-header__stat-label">Cities covered</span>
              </div>
            </div>

            <div className="app-header__search" role="search">
              <label className="visually-hidden" htmlFor="global-search-input">
                Search listings
              </label>
              <SearchMultiSelect
                suggestions={searchSuggestions}
                value={searchTokens}
                onChange={setSearchTokens}
                placeholder="Search make, model, city, specs…"
                name="global-search-input"
              />
              <p className="text-muted extra-small mb-0">
                Type to filter, press Enter to add custom terms, or pick from suggestions.
              </p>
            </div>

            <div className="app-header__filters">
              <select
                className="form-select form-select-sm"
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                aria-label="Filter by city"
              >
                <option value="">All cities</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <select
                className="form-select form-select-sm"
                value={bodyFilter}
                onChange={(e) => setBodyFilter(e.target.value)}
                aria-label="Filter by body type"
              >
                <option value="">All bodies</option>
                {bodyOptions.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
              <div className="app-header__date-filter">
                <select
                  className="form-select form-select-sm"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  aria-label="Filter by listing date"
                >
                  <option value="all">All dates</option>
                  <option value="1d">Last 1 day</option>
                  <option value="3d">Last 3 days</option>
                  <option value="1w">Last 1 week</option>
                  <option value="custom">Last N weeks…</option>
                </select>
                {dateFilter === "custom" && (
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    min="1"
                    max="52"
                    step="1"
                    value={customWeeks}
                    onChange={(e) => setCustomWeeks(e.target.value)}
                    placeholder="Weeks"
                    aria-label="Enter number of weeks"
                  />
                )}
              </div>
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleReset}>
                Reset
              </button>
            </div>

            <nav className="app-header__nav" aria-label="Primary">
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `btn ${isActive ? "btn-primary" : "btn-outline-primary"} btn-sm px-3`
                }
              >
                📊 Overview
              </NavLink>
              <NavLink
                to="/charts"
                className={({ isActive }) =>
                  `btn ${isActive ? "btn-primary" : "btn-outline-primary"} btn-sm px-3`
                }
              >
                📈 Charts
              </NavLink>
              <NavLink
                to="/flippers"
                className={({ isActive }) =>
                  `btn ${isActive ? "btn-primary" : "btn-outline-primary"} btn-sm px-3`
                }
              >
                💸 Flippers
              </NavLink>
              <NavLink
                to="/analytics"
                className={({ isActive }) =>
                  `btn ${isActive ? "btn-primary" : "btn-outline-primary"} btn-sm px-3`
                }
              >
                🧮 Analytics
              </NavLink>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container-fluid py-3">
        <Routes>
          <Route
            path="/"
            element={
              <Overview
                data={filteredData}
                resetSignal={resetSignal}
              />
            }
          />
          <Route path="/charts" element={<Charts data={filteredData} />} />
          <Route path="/flippers" element={<Flippers data={filteredData} dateWindow={dateFilterMeta} />} />
          <Route path="/analytics" element={<Analytics data={filteredData} />} />
          <Route path="/car/:id" element={<CarDetail data={data} />} />
        </Routes>
      </main>
    </div>
  );
}
