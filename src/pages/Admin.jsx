import React, { useMemo } from "react";
import { fmtPrice, esc } from "../utils";

const formatCoverage = (days) => {
  if (!Number.isFinite(days)) return "—";
  if (days <= 0) return "< 1 day";
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 8) return `${weeks} wk${weeks === 1 ? "" : "s"}`;
  const months = Math.round(days / 30);
  return `${months} mo`;
};

export default function Admin({ data = [], sources = [] }) {
  const summary = useMemo(() => {
    const uniqueSources = new Set(data.map((row) => row?.source || "primary"));
    const totalListings = data.length;
    const totalRemoved = sources.reduce((acc, src) => acc + (src.removedOutliers || 0), 0);
    return {
      totalListings,
      uniqueSources: uniqueSources.size,
      totalRemoved,
      loadedSources: sources.length
    };
  }, [data, sources]);

  return (
    <div className="container-fluid">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div>
          <h2 className="h4 mb-1">Data Sources Console</h2>
          <p className="text-muted mb-0">Monitor feed freshness, record counts, and pricing sanity checks.</p>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase extra-small mb-1">Active listings</div>
              <div className="h4 mb-0">{summary.totalListings.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase extra-small mb-1">Sources loaded</div>
              <div className="h4 mb-0">{summary.loadedSources}</div>
              <div className="text-muted small">{summary.uniqueSources} with listings</div>
            </div>
          </div>
        </div>
        <div className="col-12 col-md-3">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body">
              <div className="text-muted text-uppercase extra-small mb-1">Outliers trimmed</div>
              <div className="h4 mb-0">{summary.totalRemoved.toLocaleString()}</div>
              <div className="text-muted small">Excluded from pricing averages</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          {sources.length === 0 ? (
            <div className="p-4 text-center text-muted">No source metadata available yet.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-striped table-hover mb-0" aria-label="Data source overview">
                <thead className="table-light">
                  <tr>
                    <th scope="col">Source</th>
                    <th scope="col">Listings</th>
                    <th scope="col">Trimmed avg price</th>
                    <th scope="col">Freshest update</th>
                    <th scope="col">Coverage window</th>
                    <th scope="col">Data endpoints</th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((src) => (
                    <tr key={src.key}>
                      <th scope="row">
                        {esc(src.label || src.key)}
                        {src.datasetSourceLabels && src.datasetSourceLabels.length > 0 && (
                          <div className="text-muted small">
                            {src.datasetSourceLabels.map((label, index) => (
                              <React.Fragment key={`${src.key}-${label}-${index}`}>
                                {index > 0 ? ", " : ""}
                                {esc(label)}
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </th>
                      <td>
                        <div className="fw-semibold">{src.listingCount.toLocaleString()}</div>
                        <div className="text-muted small">
                          Raw: {Number.isFinite(src.rawCount) ? src.rawCount.toLocaleString() : "0"}
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold">
                          {Number.isFinite(src.averagePrice) ? fmtPrice(src.averagePrice) : "N/A"}
                        </div>
                        <div className="text-muted small">
                          {src.effectiveSample ?? 0} samples · {src.removedOutliers ?? 0} outliers
                        </div>
                      </td>
                      <td>
                        <div className="fw-semibold">{src.freshnessLabel || "—"}</div>
                        {src.lastUpdatedIso && (
                          <div className="text-muted small">{new Date(src.lastUpdatedIso).toLocaleString()}</div>
                        )}
                      </td>
                      <td>
                        <div className="fw-semibold">{formatCoverage(src.coverageDays)}</div>
                        {src.oldestIso && (
                          <div className="text-muted small">From {new Date(src.oldestIso).toLocaleDateString()}</div>
                        )}
                      </td>
                      <td>
                        {src.urls && src.urls.length ? (
                          <ul className="list-unstyled mb-0 text-break">
                            {src.urls.map((url) => (
                              <li key={url} className="small">
                                <a href={url} target="_blank" rel="noreferrer" className="link-primary">
                                  {url}
                                </a>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="text-muted small">No URL configured</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
