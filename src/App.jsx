import React, { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { uniq, num, cmp, fmtPrice, fmtKM, groupBy, safeAvg, esc } from "./utils";

const DEFAULT_SORT_KEY = "created_at_epoch_iso";
const DEFAULT_SORT_DIR = "desc";

// Read URL from environment or window fallback
const R2_URL =
  import.meta.env.VITE_R2_JSON_URL?.trim() ||
  (typeof window !== "undefined" && window.__R2_JSON_URL__) ||
  "";

export default function App() {
  const [data, setData] = useState([]);
  const [view, setView] = useState([]);

  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [body, setBody] = useState("");
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT_DIR);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // load
  useEffect(() => {
    (async () => {
      try {
        if (!R2_URL) throw new Error("R2 JSON URL not set. Set VITE_R2_JSON_URL or window.__R2_JSON_URL__.");
        const res = await fetch(R2_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`Fetch failed ${res.status}`);
        const rows = await res.json();

        // Normalize numeric fields
        rows.forEach((d) => {
          d.price = num(d.price);
          d.details_kilometers = num(d.details_kilometers);
          d.details_year = num(d.details_year);
        });
        setData(rows);
        setLoading(false);
      } catch (e) {
        setError(String(e.message || e));
        setLoading(false);
      }
    })();
  }, []);

  // Filters
  const cities = useMemo(() => uniq(data.map((d) => d.city_inferred).filter(Boolean)).sort(), [data]);
  const bodies = useMemo(() => uniq(data.map((d) => d.details_body_type).filter(Boolean)).sort(), [data]);

  useEffect(() => {
    let v = data.filter((d) => {
      if (city && d.city_inferred !== city) return false;
      if (body && d.details_body_type !== body) return false;
      if (q) {
        const blob = [d.title_en, d.city_inferred, d.details_body_type].join(" ").toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    v.sort((a, b) => cmp(a[sortKey], b[sortKey]) * dir);

    setView(v);
  }, [data, q, city, body, sortKey, sortDir]);

  // KPIs
  const kpi = useMemo(() => {
    const count = view.length;
    const avg = safeAvg(view.map((d) => d.price));
    const uniqueCities = uniq(view.map((d) => d.city_inferred).filter(Boolean)).length;
    return { count, avg, uniqueCities };
  }, [view]);

  // Chart: Avg Price by City
  const chartData = useMemo(() => {
    const groups = groupBy(view, (d) => d.city_inferred || "Unknown");
    return Object.keys(groups).map((k) => ({ city: k, avgPrice: safeAvg(groups[k].map((x) => x.price)) || 0 }));
  }, [view]);

  const onHeaderClick = (key) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  if (loading) return <div className="container"><p>Loading…</p></div>;
  if (error) return <div className="container"><p style={{color:"#b00020"}}>Error: {error}</p></div>;

  return (
    <div className="container">
      <header>
        <h1>Dubizzle Listings Dashboard</h1>
        <div className="controls">
          <input placeholder="Search title/city/body…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={body} onChange={(e) => setBody(e.target.value)}>
            <option value="">All bodies</option>
            {bodies.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <button onClick={() => { setQ(""); setCity(""); setBody(""); }}>Reset</button>
        </div>

        <div className="stats">
          <div className="stat"><b>Count</b><span>{kpi.count}</span></div>
          <div className="stat"><b>Avg Price</b><span>{fmtPrice(kpi.avg)}</span></div>
          <div className="stat"><b>Cities</b><span>{kpi.uniqueCities}</span></div>
        </div>
      </header>

      <section className="card chart-card">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="city" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avgPrice" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                ["id","id"],
                ["Title","title_en"],
                ["Price","price"],
                ["City","city_inferred"],
                ["Body","details_body_type"],
                ["Year","details_year"],
                ["KM","details_kilometers"],
                ["Links", null]
              ].map(([label, key]) => (
                <th key={label} onClick={key ? () => onHeaderClick(key) : undefined}>
                  {label}{key && (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map((d) => (
              <tr key={d.id ?? Math.random()}>
                <td>{d.id ?? ""}</td>
                <td title={d.title_en || ""}>{esc(d.title_en)}</td>
                <td>{fmtPrice(d.price)}</td>
                <td>{esc(d.city_inferred)}</td>
                <td>{esc(d.details_body_type)}</td>
                <td>{d.details_year ?? ""}</td>
                <td>{fmtKM(d.details_kilometers)}</td>
                <td className="link">
                  {d.url ? <a href={d.url} target="_blank" rel="noreferrer">Listing</a> : null}
                  {d.permalink ? <> | <a href={d.permalink} target="_blank" rel="noreferrer">Contact</a></> : null}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr><td colSpan="8">Rows: {view.length}</td></tr>
          </tfoot>
        </table>
      </section>

      <div className="footer">
        Data is loaded from your public R2 JSON. Dubizzle does not expose phone numbers; only availability flags and contact links.
      </div>
    </div>
  );
}
