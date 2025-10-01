import React, { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { esc, fmtPrice } from "../utils";

export default function CarDetail({ data }) {
  const { id } = useParams();

  const car = useMemo(() => data.find(d => d.uid === id), [data, id]);

  const brandModelTotal = useMemo(() => {
    if (!car) return 0;
    const mk = (car.details_make || car.brand || "").toLowerCase();
    const md = (car.details_model || car.model || "").toLowerCase();
    return data.filter(x => (x.details_make || x.brand || "").toLowerCase() === mk && (x.details_model || x.model || "").toLowerCase() === md).length;
  }, [car, data]);

  if (!car) {
    return (
      <div className="container">
        <div className="alert alert-warning mt-3">Car not found.</div>
        <Link className="btn btn-outline-primary" to="/">Back to Overview</Link>
      </div>
    );
  }

  const marketAvg = car.market_avg;
  const marketDiff = car.market_diff;

  const primaryLink = car.url || car.permalink || "";

  // Prepare flat key/value view of attributes
  const entries = Object.entries(car);

  return (
    <div className="container">
      <div className="d-flex align-items-center justify-content-between mt-3 mb-3">
        <h2 className="h4 mb-0">Car Details</h2>
        <Link className="btn btn-outline-primary" to="/">← Back</Link>
      </div>

      <div className="row g-3 mb-3">
        <div className="col-12 col-lg-8">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h5 mb-0">Attributes</h3>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm table-striped align-middle">
                  <thead>
                    <tr>
                      <th style={{width: '240px'}}>Field</th>
                      <th>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map(([k, v]) => (
                      <tr key={k}>
                        <td className="text-muted">{esc(k)}</td>
                        <td style={{whiteSpace:'pre-wrap'}}>{esc(typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-4">
          <div className="card border-0 shadow-sm mb-3">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h5 mb-0">Market Metrics</h3>
            </div>
            <div className="card-body">
              <div className="mb-2"><span className="text-muted">Market Average (3m):</span> <strong>{marketAvg != null ? fmtPrice(marketAvg) : 'N/A'}</strong></div>
              <div className="mb-2"><span className="text-muted">Market Diff:</span> <strong>{marketDiff != null ? fmtPrice(marketDiff) : 'N/A'}</strong> <small className="text-muted">(avg - price)</small></div>
              <div className="mb-2"><span className="text-muted">Total in Brand/Model:</span> <strong>{brandModelTotal}</strong></div>
            </div>
          </div>

          {primaryLink && (
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-0 pb-0">
                <h3 className="card-title h5 mb-0">Original Listing</h3>
              </div>
              <div className="card-body">
                <a href={primaryLink} target="_blank" rel="noreferrer" className="btn btn-primary w-100">Open Listing</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

