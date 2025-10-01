import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fmtPrice, esc } from "../utils";

export default function Flippers({ data }) {
  const navigate = useNavigate();

  const { items, sinceDays } = useMemo(() => {
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const cutoff = now - sevenDaysMs;

    const rows = data
      .filter(d => Number.isFinite(d.created_at_epoch_ms) && d.created_at_epoch_ms >= cutoff)
      .filter(d => Number.isFinite(d.market_diff) && d.market_diff > 0)
      .map(d => ({ ...d }));

    // Sort: most recent first, then highest discount
    rows.sort((a, b) => {
      if (a.created_at_epoch_ms !== b.created_at_epoch_ms) return b.created_at_epoch_ms - a.created_at_epoch_ms;
      const da = Number.isFinite(a.market_diff) ? a.market_diff : -Infinity;
      const db = Number.isFinite(b.market_diff) ? b.market_diff : -Infinity;
      return db - da;
    });

    return { items: rows, sinceDays: 7 };
  }, [data]);

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h4 mb-0">Flippers Central</h2>
        <div className="text-muted">Showing cars from last {sinceDays} days</div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive" style={{ overflowX: "auto" }}>
            <table className="table table-hover table-striped mb-0 text-nowrap align-middle" style={{ minWidth: "1100px" }}>
              <thead className="table-light">
                <tr>
                  <th>When</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Year</th>
                  <th>Price</th>
                  <th>Location</th>
                  <th>Seller Type</th>
                  <th>Regional Specs</th>
                  <th>Market Discount</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.uid}>
                    <td className="text-muted small">{d.created_at_epoch_ms ? new Date(d.created_at_epoch_ms).toLocaleString() : ''}</td>
                    <td className="fw-semibold">{esc(d.details_make || d.brand || '')}</td>
                    <td className="text-muted">{esc(d.details_model || d.model || '')}</td>
                    <td>{d.details_year ?? ''}</td>
                    <td className="fw-semibold text-success">{Number.isFinite(d.price) ? fmtPrice(d.price) : ''}</td>
                    <td className="text-info">{esc(d.location_full || d.city_inferred || '')}</td>
                    <td>{esc(d.details_seller_type || '')}</td>
                    <td>{esc(d.details_regional_specs || '')}</td>
                    <td className="fw-bold text-success">{Number.isFinite(d.market_diff) ? fmtPrice(d.market_diff) : 'N/A'}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => navigate(`/car/${d.uid}`)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
