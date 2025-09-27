import React, { useEffect, useMemo, useState } from "react";
import { uniq, cmp, fmtPrice, groupBy, safeAvg, esc } from "../utils";

const DEFAULT_SORT_KEY = "created_at_epoch_ms";
const DEFAULT_SORT_DIR = "desc";

export default function Overview({ data }) {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [body, setBody] = useState("");
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT_DIR);
  const [view, setView] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

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
        const blob = [
          d.brand,
          d.model,
          d.location_full,
          d.title_en,
          d.city_inferred,
          d.details_body_type
        ].join(" ").toLowerCase();
        if (!blob.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    v.sort((a,b) => cmp(a[sortKey], b[sortKey]) * dir);
    setView(v);
    setCurrentPage(1); // Reset to first page when filters change
  }, [data, q, city, body, sortKey, sortDir]);

  const kpi = useMemo(() => {
    const count = view.length;
    const avg = safeAvg(view.map(d => d.price));
    const uniqueCities = uniq(view.map(d => d.city_inferred).filter(Boolean)).length;
    return { count, avg, uniqueCities };
  }, [view]);

  // Pagination calculations
  const totalPages = Math.ceil(view.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = view.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onHeaderClick = (key) => {
    if (!key) return;
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  return (
    <div className="container-fluid">
      {/* Filters */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-4">
              <label className="form-label fw-semibold">Search</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="Search title/location/body type…" 
                value={q} 
                onChange={(e)=>setQ(e.target.value)} 
              />
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">City</label>
              <select 
                className="form-select" 
                value={city} 
                onChange={(e)=>setCity(e.target.value)}
              >
                <option value="">All cities</option>
                {cities.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label fw-semibold">Body Type</label>
              <select 
                className="form-select" 
                value={body} 
                onChange={(e)=>setBody(e.target.value)}
              >
                <option value="">All bodies</option>
                {bodies.map(b => <option key={b}>{b}</option>)}
              </select>
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <button 
                className="btn btn-outline-secondary w-100" 
                onClick={()=>{ 
                  setQ(""); 
                  setCity(""); 
                  setBody(""); 
                  setSortKey(DEFAULT_SORT_KEY); 
                  setSortDir(DEFAULT_SORT_DIR); 
                }}
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="table-light">
                <tr>
                  {[
                    ["When","created_at_epoch_ms"],
                    ["Brand","brand"],
                    ["Model","model"],
                    ["Year","details_year"],
                    ["Price","price"],
                    ["Location","location_full"],
                    ["Title","title_en"],
                    ["Links", null]
                  ].map(([label, key]) => (
                    <th 
                      key={label} 
                      className={key ? "cursor-pointer" : ""}
                      onClick={key ? ()=>onHeaderClick(key) : undefined}
                    >
                      {label}
                      {key && ( (sortKey===key) ? (sortDir==="asc" ? " ▲" : " ▼") : "" )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentItems.map(d => {
                  const day = Number.isFinite(d.created_at_epoch_ms)
                    ? new Date(d.created_at_epoch_ms).toISOString().slice(0,10)
                    : null;
                  const isRecent = latestDay && day === latestDay;
                  
                  const brand = d.brand || "";
                  const model = d.model || "";
                  const location = d.location_full || d.city_inferred || "";
                  
                  return (
                    <tr key={d.id ?? Math.random()} className={isRecent ? "table-warning" : ""}>
                      <td className="text-muted small">
                        {d.created_at_epoch_ms ? new Date(d.created_at_epoch_ms).toLocaleString() : ""}
                        {isRecent && <span className="badge bg-warning text-dark ms-2">Latest</span>}
                      </td>
                      <td className="fw-semibold">{esc(brand)}</td>
                      <td className="text-muted">{esc(model)}</td>
                      <td>{d.details_year ?? ""}</td>
                      <td className="fw-bold text-success">{fmtPrice(d.price)}</td>
                      <td className="text-info">{esc(location)}</td>
                      <td title={d.title_en || ""} className="text-truncate" style={{maxWidth: '200px'}}>
                        {esc(d.title_en)}
                      </td>
                      <td>
                        {d.url ? (
                          <a href={d.url} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary me-1">
                            Listing
                          </a>
                        ) : null}
                        {d.permalink ? (
                          <a href={d.permalink} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-secondary">
                            Contact
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-between align-items-center mt-4">
          <div className="text-muted">
            Showing {startIndex + 1} to {Math.min(endIndex, view.length)} of {view.length} entries
          </div>
          <nav>
            <ul className="pagination pagination-sm mb-0">
              <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
              </li>
              
              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                if (
                  page === 1 || 
                  page === totalPages || 
                  (page >= currentPage - 2 && page <= currentPage + 2)
                ) {
                  return (
                    <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    </li>
                  );
                } else if (
                  page === currentPage - 3 || 
                  page === currentPage + 3
                ) {
                  return <li key={page} className="page-item disabled"><span className="page-link">...</span></li>;
                }
                return null;
              })}
              
              <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
