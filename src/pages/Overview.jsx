import React, { useEffect, useMemo, useState } from "react";
import { uniq, cmp, fmtPrice, fmtKM, groupBy, safeAvg, esc } from "../utils";

const DEFAULT_SORT_KEY = "created_at_epoch_ms";
const DEFAULT_SORT_DIR = "desc";

export default function Overview({ data }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [body, setBody] = useState("");
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT_DIR);
  const [view, setView] = useState([]);

  const cities = useMemo(() => uniq(data.map(d => d.city_inferred).filter(Boolean)).sort(), [data]);
  const bodies = useMemo(() => uniq(data.map(d => d.details_body_type).filter(Boolean)).sort(), [data]);

  // Compute the latest day string across all rows: "YYYY-MM-DD"
  const latestDay = useMemo(() => {
    const days = data
      .filter(d => Number.isFinite(d.created_at_epoch_ms))
      .map(d => new Date(d.created_at_epoch_ms).toISOString().slice(0,10));
    if (!days.length) return null;
    return days.sort().at(-1);
  }, [data]);

  useEffect(() => {
    let v = data.filter((d) => {
      if (city && d.city_inferred !== city) return false;
      if (body && d.details_body_type !== body) return false;
      if (q) {
        const blob = [d.title_en, d.details_make, d.city_inferred, d.details_body_type].join(" ").toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    v.sort((a,b) => cmp(a[sortKey], b[sortKey]) * dir);
    setView(v);
  }, [data, q, city, body, sortKey, sortDir]);

  const kpi = useMemo(() => {
    const count = view.length;
    const avg = safeAvg(view.map(d => d.price));
    const uniqueCities = uniq(view.map(d => d.city_inferred).filter(Boolean)).length;
    return { count, avg, uniqueCities };
  }, [view]);

  const onHeaderClick = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <>
      <header>
        <h1>Overview</h1>
        <div className="controls">
          <input placeholder="Search brand/model/title/city/body…" value={q} onChange={(e)=>setQ(e.target.value)} />
          <select value={city} onChange={(e)=>setCity(e.target.value)}>
            <option value="">All cities</option>
            {cities.map(c => <option key={c}>{c}</option>)}
          </select>
          <select value={body} onChange={(e)=>setBody(e.target.value)}>
            <option value="">All bodies</option>
            {bodies.map(b => <option key={b}>{b}</option>)}
          </select>
          <button onClick={()=>{ setQ(""); setCity(""); setBody(""); setSortKey(DEFAULT_SORT_KEY); setSortDir(DEFAULT_SORT_DIR); }}>Reset</button>
        </div>
        <div className="stats">
          <div className="stat"><b>Count</b><span>{kpi.count}</span></div>
          <div className="stat"><b>Avg Price</b><span>{fmtPrice(kpi.avg)}</span></div>
          <div className="stat"><b>Cities</b><span>{kpi.uniqueCities}</span></div>
        </div>
      </header>

      <section className="table-wrap">
        <table>
          <thead>
            <tr>
              {[
                ["When","created_at_epoch_ms"],
                ["Brand","details_make"],
                ["Model","title_en"],
                ["Year","details_year"],
                ["Price","price"],
                ["Title","title_en"],
                ["Links", null]
              ].map(([label, key]) => (
                <th key={label} onClick={key ? ()=>onHeaderClick(key) : undefined}>
                  {label}
                  {key && ( (sortKey===key) ? (sortDir==="asc" ? " ▲" : " ▼") : "" )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.map(d => {
              const day = Number.isFinite(d.created_at_epoch_ms)
                ? new Date(d.created_at_epoch_ms).toISOString().slice(0,10)
                : null;
              const isRecent = latestDay && day === latestDay;
              
              // Extract model from title (first word after brand)
              const getModel = (title, brand) => {
                if (!title) return "";
                const titleWords = title.split(" ");
                if (brand && titleWords.length > 1) {
                  const brandIndex = titleWords.findIndex(word => 
                    word.toLowerCase().includes(brand.toLowerCase())
                  );
                  if (brandIndex >= 0 && titleWords[brandIndex + 1]) {
                    return titleWords[brandIndex + 1];
                  }
                }
                return titleWords[1] || titleWords[0] || "";
              };
              
              const brand = d.details_make || "";
              const model = getModel(d.title_en, brand);
              
              return (
                <tr key={d.id ?? Math.random()} className={isRecent ? "recent-day" : undefined}>
                  <td className="timestamp">
                    {d.created_at_epoch_ms ? new Date(d.created_at_epoch_ms).toLocaleString() : ""}
                    {isRecent && <span className="badge-recent">latest</span>}
                  </td>
                  <td className="brand">{esc(brand)}</td>
                  <td className="model">{esc(model)}</td>
                  <td>{d.details_year ?? ""}</td>
                  <td className="price">{fmtPrice(d.price)}</td>
                  <td title={d.title_en || ""}>
                    {esc(d.title_en)}
                  </td>
                  <td className="link">
                    {d.url ? <a href={d.url} target="_blank" rel="noreferrer">Listing</a> : null}
                    {d.permalink ? <> | <a href={d.permalink} target="_blank" rel="noreferrer">Contact</a></> : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td colSpan="7">Rows: {view.length}</td></tr></tfoot>
        </table>
      </section>
    </>
  );
}
