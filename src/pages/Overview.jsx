import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cmp, fmtPrice, esc } from "../utils";

const DEFAULT_SORT_KEY = "created_at_epoch_ms";
const DEFAULT_SORT_DIR = "desc";

export default function Overview({ data, resetSignal = 0 }) {
  const navigate = useNavigate();
  const [sortKey, setSortKey] = useState(DEFAULT_SORT_KEY);
  const [sortDir, setSortDir] = useState(DEFAULT_SORT_DIR);
  const [view, setView] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);

  // Compute the latest day string across all rows: "YYYY-MM-DD"
  const latestDay = useMemo(() => {
    const days = data
      .filter(d => Number.isFinite(d.created_at_epoch_ms))
      .map(d => new Date(d.created_at_epoch_ms).toISOString().slice(0,10));
    if (!days.length) return null;
    return days.sort().at(-1);
  }, [data]);

  useEffect(() => {
    const v = data.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortKey === DEFAULT_SORT_KEY) {
      // Composite sort: by date, then market_diff (desc) within same calendar day
      v.sort((a, b) => {
        const dayA = a.created_at_day || "";
        const dayB = b.created_at_day || "";
        if (dayA !== dayB) return cmp(a.created_at_epoch_ms, b.created_at_epoch_ms) * -1; // date desc primary
        const mdA = Number.isFinite(a.market_diff) ? a.market_diff : -Infinity;
        const mdB = Number.isFinite(b.market_diff) ? b.market_diff : -Infinity;
        if (mdA !== mdB) return mdB - mdA; // higher market_diff first
        return cmp(a.created_at_epoch_ms, b.created_at_epoch_ms) * -1; // stable within day
      });
    } else {
      v.sort((a,b) => cmp(a[sortKey], b[sortKey]) * dir);
    }
    setView(v);
    setCurrentPage(1); // Reset to first page when data changes
  }, [data, sortKey, sortDir]);

  useEffect(() => {
    setSortKey(DEFAULT_SORT_KEY);
    setSortDir(DEFAULT_SORT_DIR);
    setCurrentPage(1);
  }, [resetSignal]);

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
      {/* Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive" style={{ overflowX: "auto" }}>
            <table className="table table-hover table-striped mb-0 text-nowrap align-middle" style={{ minWidth: "1200px" }}>
              <thead className="table-light">
                <tr>
                  {[
                    ["When","created_at_epoch_ms"],
                    ["Make","details_make"],
                    ["Model","details_model"],
                    ["Year","details_year"],
                    ["Price","price"],
                    ["Location","location_full"],
                    ["Neighbourhood","neighbourhood_en"],
                    ["Regional Specs","details_regional_specs"],
                    ["Seller Type","details_seller_type"],
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
                  const make = d.details_make || brand;
                  const modelDisplay = d.details_model || model;
                  const neighbourhood = d.neighbourhood_en || "";
                  const regionalSpecs = d.details_regional_specs || "";
                  const sellerType = d.details_seller_type || "";
                  const primaryLink = d.url || d.permalink || "";
                  const clickable = Boolean(d.uid);

                  return (
                    <tr
                      key={d.uid || d.id || `${d.details_make}-${d.details_model}-${d.created_at_epoch_ms}`}
                      className={isRecent ? "table-warning" : ""}
                      onClick={() => { if (clickable) navigate(`/car/${d.uid}`); }}
                      onKeyDown={(e) => {
                        if (!clickable) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          window.open(primaryLink, "_blank", "noopener");
                        }
                      }}
                      role={clickable ? "link" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      style={{ cursor: clickable ? "pointer" : "default" }}
                    >
                      <td className="text-muted small">
                        {d.created_at_epoch_ms ? new Date(d.created_at_epoch_ms).toLocaleString() : ""}
                        {isRecent && <span className="badge bg-warning text-dark ms-2">Latest</span>}
                      </td>
                      <td className="fw-semibold">{esc(make)}</td>
                      <td className="text-muted">{esc(modelDisplay)}</td>
                      <td>{d.details_year ?? ""}</td>
                      <td className="fw-bold text-success">{fmtPrice(d.price)}</td>
                      <td className="text-info">{esc(location)}</td>
                      <td>{esc(neighbourhood)}</td>
                      <td>{esc(regionalSpecs)}</td>
                      <td>{esc(sellerType)}</td>
                      <td title={d.title_en || ""} className="text-truncate" style={{maxWidth: '200px'}}>
                        {esc(d.title_en)}
                      </td>
                      <td>
                        {d.url ? (
                          <a
                            href={d.url}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Listing
                          </a>
                        ) : null}
                        {d.permalink ? (
                          <a
                            href={d.permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={(e) => e.stopPropagation()}
                          >
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
