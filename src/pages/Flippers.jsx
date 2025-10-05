import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { fmtPrice, esc } from "../utils";

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;
const formatPercent = (value) => (Number.isFinite(value) ? `${value.toFixed(1)}%` : "N/A");

export default function Flippers({ data, dateWindow }) {
  const navigate = useNavigate();

  const { items, rangeLabel } = useMemo(() => {
    const now = Date.now();
    const hasGlobalRange = dateWindow?.cutoffMs != null;
    const effectiveCutoff = hasGlobalRange ? dateWindow.cutoffMs : now - 7 * MILLIS_PER_DAY;
    const label = hasGlobalRange ? (dateWindow?.label || "Filtered range") : "last 7 days";

    const rows = data
      .filter((d) => Number.isFinite(d.created_at_epoch_ms) && d.created_at_epoch_ms >= effectiveCutoff)
      .filter((d) => Number.isFinite(d.market_diff) && d.market_diff > 0)
      .map((d) => ({ ...d }));

    const byDay = new Map();
    for (const row of rows) {
      const day = row.created_at_day || new Date(row.created_at_epoch_ms).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day).push(row);
    }

    const sortedDays = Array.from(byDay.keys()).sort((a, b) => b.localeCompare(a));
    const ordered = [];
    for (const day of sortedDays) {
      const group = byDay.get(day).slice();
      group.sort((a, b) => {
        const pctA = Number.isFinite(a.market_discount_pct) ? a.market_discount_pct : -Infinity;
        const pctB = Number.isFinite(b.market_discount_pct) ? b.market_discount_pct : -Infinity;
        if (pctA !== pctB) return pctB - pctA;
        const diffA = Number.isFinite(a.market_diff) ? a.market_diff : -Infinity;
        const diffB = Number.isFinite(b.market_diff) ? b.market_diff : -Infinity;
        if (diffA !== diffB) return diffB - diffA;
        return (b.created_at_epoch_ms ?? 0) - (a.created_at_epoch_ms ?? 0);
      });
      ordered.push(...group);
    }

    return { items: ordered, rangeLabel: label };
  }, [data, dateWindow?.cutoffMs, dateWindow?.label]);

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h2 className="h4 mb-0">Flippers Central</h2>
        <div className="text-muted">Showing cars from {rangeLabel}</div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive" style={{ overflowX: "auto" }}>
            <table className="table table-hover table-striped mb-0 text-nowrap align-middle" style={{ minWidth: "1150px" }}>
              <thead className="table-light">
                <tr>
                  <th>When</th>
                  <th>Brand</th>
                  <th>Model</th>
                  <th>Year</th>
                  <th>Price</th>
                  <th>Market Discount</th>
                  <th>Discount %</th>
                  <th>Location</th>
                  <th>Seller Type</th>
                  <th>Regional Specs</th>
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
                    <td className="fw-semibold text-success">
                      {Number.isFinite(d.price) ? fmtPrice(d.price) : ''}
                      {Number.isFinite(d.market_avg) && (
                        <div className="small text-muted">Avg: {fmtPrice(d.market_avg)}</div>
                      )}
                    </td>
                    <td className="fw-bold text-success">{Number.isFinite(d.market_diff) ? fmtPrice(d.market_diff) : 'N/A'}</td>
                    <td className="fw-bold text-success">{formatPercent(d.market_discount_pct)}</td>
                    <td className="text-info">{esc(d.location_full || d.city_inferred || '')}</td>
                    <td>{esc(d.details_seller_type || '')}</td>
                    <td>{esc(d.details_regional_specs || '')}</td>
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
