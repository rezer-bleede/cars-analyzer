import React, { useEffect, useMemo, useState } from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import Overview from "./pages/Overview.jsx";
import Charts from "./pages/Charts.jsx";
import CarDetail from "./pages/CarDetail.jsx";
import { num, normalizeTimestamp, deriveBrand, deriveModel, deriveFullLocation, hash32 } from "./utils";

const R2_URL =
  import.meta.env.VITE_R2_JSON_URL?.trim() ||
  (typeof window !== "undefined" && window.__R2_JSON_URL__) ||
  "";

export default function App() {
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [bodyFilter, setBodyFilter] = useState("");
  const [resetSignal, setResetSignal] = useState(0);

  const cityOptions = useMemo(
    () => [...new Set(data.map((d) => d.city_inferred).filter(Boolean))].sort(),
    [data]
  );
  const bodyOptions = useMemo(
    () => [...new Set(data.map((d) => d.details_body_type).filter(Boolean))].sort(),
    [data]
  );

  useEffect(() => {
    (async () => {
      try {
        if (!R2_URL) throw new Error("R2 JSON URL not set. Set VITE_R2_JSON_URL or window.__R2_JSON_URL__.");
        const res = await fetch(R2_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
        const rows = await res.json();

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
        }

        setData(rows);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (err) return <div className="container"><p style={{color:"#b00020"}}>Error: {err}</p></div>;

  // Calculate stats for header
  const stats = {
    totalListings: data.length,
    avgPrice: data.length > 0 ? Math.round(data.reduce((sum, d) => sum + (d.price || 0), 0) / data.length) : 0,
    cities: new Set(data.map(d => d.city_inferred).filter(Boolean)).size
  };

  const handleReset = () => {
    setSearch("");
    setCityFilter("");
    setBodyFilter("");
    setResetSignal((n) => n + 1);
  };

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <header className="bg-white shadow-sm border-bottom sticky-top" style={{ zIndex: 1030 }}>
        <div className="container-fluid">
          <div className="d-flex align-items-center gap-3 py-1 flex-wrap flex-lg-nowrap">
            <div className="d-flex flex-column me-3 flex-shrink-0">
              <h1 className="h5 mb-0 text-primary fw-bold">🚗 Used Cars Dashboard</h1>
              <span className="text-muted small">Real-time car listings analysis</span>
            </div>

            <div className="d-flex align-items-center gap-3 ms-auto flex-wrap flex-lg-nowrap justify-content-end w-100">
              <div className="d-flex align-items-center gap-3 order-3 order-lg-1 text-muted small flex-shrink-0">
                <div className="text-end">
                  <div className="fw-semibold text-primary">{stats.totalListings.toLocaleString()}</div>
                  <div>Total</div>
                </div>
                <div className="text-end">
                  <div className="fw-semibold text-success">AED {stats.avgPrice.toLocaleString()}</div>
                  <div>Avg Price</div>
                </div>
                <div className="text-end">
                  <div className="fw-semibold text-info">{stats.cities}</div>
                  <div>Cities</div>
                </div>
              </div>

              <form
                className="order-1 flex-grow-1 flex-lg-grow-0"
                onSubmit={(e) => e.preventDefault()}
                role="search"
              >
                <input
                  type="search"
                  className="form-control form-control-sm"
                  placeholder="Search make, model, location…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ minWidth: "200px", maxWidth: "260px" }}
                  aria-label="Search listings"
                />
              </form>

              <div className="d-flex align-items-center gap-2 order-2 flex-shrink-0">
                <select
                  className="form-select form-select-sm"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                  style={{ minWidth: "150px" }}
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
                  style={{ minWidth: "150px" }}
                  aria-label="Filter by body type"
                >
                  <option value="">All bodies</option>
                  {bodyOptions.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleReset}>
                  Reset
                </button>
              </div>

              <nav className="d-flex align-items-center gap-2 order-4 order-lg-3 flex-shrink-0">
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
              </nav>
            </div>
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
                data={data}
                searchQuery={search}
                cityFilter={cityFilter}
                bodyFilter={bodyFilter}
                resetSignal={resetSignal}
              />
            }
          />
          <Route path="/charts" element={<Charts data={data} />} />
          <Route path="/car/:id" element={<CarDetail data={data} />} />
        </Routes>
      </main>
    </div>
  );
}
