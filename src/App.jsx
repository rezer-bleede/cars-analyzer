import React, { useEffect, useState } from "react";
import { NavLink, Routes, Route } from "react-router-dom";
import Overview from "./pages/Overview.jsx";
import Charts from "./pages/Charts.jsx";
import { num, normalizeTimestamp } from "./utils";

const R2_URL =
  import.meta.env.VITE_R2_JSON_URL?.trim() ||
  (typeof window !== "undefined" && window.__R2_JSON_URL__) ||
  "";

export default function App() {
  const [data, setData] = useState([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

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

          // Normalize actual timestamp from listings.json (whichever field exists)
          const ts = normalizeTimestamp(d);
          d.created_at_epoch_ms = ts.ms;
          d.created_at_iso = ts.iso;
        });

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

  return (
    <div className="min-vh-100 bg-light">
      {/* Header */}
      <header className="bg-white shadow-sm border-bottom">
        <div className="container-fluid">
          <div className="row align-items-center py-3">
            <div className="col-md-6">
              <h1 className="h3 mb-0 text-primary fw-bold">🚗 Used Cars Dashboard</h1>
              <p className="text-muted mb-0">Real-time car listings analysis</p>
            </div>
            <div className="col-md-6">
              <nav className="d-flex justify-content-end gap-2">
                <NavLink 
                  to="/" 
                  end 
                  className={({isActive}) => 
                    `btn ${isActive ? 'btn-primary' : 'btn-outline-primary'} px-3 py-2`
                  }
                >
                  📊 Overview
                </NavLink>
                <NavLink 
                  to="/charts" 
                  className={({isActive}) => 
                    `btn ${isActive ? 'btn-primary' : 'btn-outline-primary'} px-3 py-2`
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
      <main className="container-fluid py-4">
        <Routes>
          <Route path="/" element={<Overview data={data} />} />
          <Route path="/charts" element={<Charts data={data} />} />
        </Routes>
      </main>
    </div>
  );
}
