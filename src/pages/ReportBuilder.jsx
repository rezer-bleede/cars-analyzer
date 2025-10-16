import React, { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { groupBy, safeAvg } from "../utils";

const computeMedian = (values) => {
  const sorted = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }
  return Math.round(sorted[mid]);
};

const average = (values) => {
  const valid = values
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const formatCurrency = (value) => `AED ${Math.round(value ?? 0).toLocaleString("en-US")}`;
const formatPercent = (value) => `${Number(value ?? 0).toFixed(1)}%`;

const TIMEFRAME_LABELS = {
  "3m": "Last 3 months",
  "6m": "Last 6 months",
  "12m": "Last 12 months",
  ytd: "Year to date"
};

const slugify = (value) =>
  String(value || "report")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "") || "report";

export default function ReportBuilder({ data }) {
  const [title, setTitle] = useState("Comprehensive Market Intelligence Report");
  const [preparedFor, setPreparedFor] = useState("");
  const [focusCity, setFocusCity] = useState("");
  const [timeframe, setTimeframe] = useState("6m");
  const [notes, setNotes] = useState("");
  const [sections, setSections] = useState({
    snapshot: true,
    brands: true,
    body: true,
    insights: true
  });

  const generatedAt = useMemo(() => new Date(), []);

  const normalizedData = useMemo(
    () => data.filter((row) => Number.isFinite(row.price)),
    [data]
  );

  const cityOptions = useMemo(
    () =>
      [...new Set(normalizedData.map((row) => row.city_inferred).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [normalizedData]
  );

  const scopedData = useMemo(
    () => (focusCity ? normalizedData.filter((row) => row.city_inferred === focusCity) : normalizedData),
    [normalizedData, focusCity]
  );

  const summary = useMemo(() => {
    const listings = scopedData.length;
    const avgPrice = safeAvg(scopedData.map((row) => row.price)) || 0;
    const medianPrice = computeMedian(scopedData.map((row) => row.price));
    const avgMileage = safeAvg(scopedData.map((row) => row.details_kilometers)) || 0;
    const avgDiscount = average(scopedData.map((row) => row.market_discount_pct));
    const cities = new Set(scopedData.map((row) => row.city_inferred).filter(Boolean)).size;

    const brands = Object.entries(groupBy(scopedData, (row) => row.details_make || row.brand || "Unknown"))
      .map(([brand, rows]) => ({
        brand,
        listings: rows.length,
        avgPrice: safeAvg(rows.map((row) => row.price)) || 0,
        avgDiscount: average(rows.map((row) => row.market_discount_pct))
      }))
      .filter((entry) => entry.brand !== "Unknown")
      .sort((a, b) => b.listings - a.listings)
      .slice(0, 5);

    const bodyTypes = Object.entries(groupBy(scopedData, (row) => row.details_body_type || "Unknown"))
      .map(([body, rows]) => ({
        body,
        listings: rows.length,
        share: listings ? (rows.length / listings) * 100 : 0
      }))
      .sort((a, b) => b.listings - a.listings)
      .slice(0, 5);

    const models = Object.entries(
      groupBy(scopedData, (row) => `${row.details_make || row.brand || "Unknown"} ${row.details_model || row.model || ""}`.trim())
    )
      .map(([label, rows]) => ({
        label,
        listings: rows.length,
        avgPrice: safeAvg(rows.map((row) => row.price)) || 0,
        avgDiscount: average(rows.map((row) => row.market_discount_pct))
      }))
      .filter((entry) => entry.label && entry.label !== "Unknown")
      .sort((a, b) => b.listings - a.listings)
      .slice(0, 5);

    const insights = [];
    if (brands[0]) {
      insights.push(
        `${brands[0].brand} leads activity with ${brands[0].listings.toLocaleString()} listings averaging ${formatCurrency(brands[0].avgPrice)}.`
      );
    }
    if (avgDiscount != null) {
      insights.push(`Average market discount sits at ${formatPercent(avgDiscount)} across the selection.`);
    }
    if (models[0]) {
      insights.push(
        `${models[0].label} remains a top-of-mind nameplate with ${models[0].listings.toLocaleString()} recent listings.`
      );
    }
    return {
      listings,
      avgPrice,
      medianPrice,
      avgMileage,
      avgDiscount,
      cities,
      brands,
      bodyTypes,
      models,
      insights
    };
  }, [scopedData]);

  const updateSection = (key) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const timeframeLabel = TIMEFRAME_LABELS[timeframe] || TIMEFRAME_LABELS["6m"];

  const handleDownload = () => {
    if (!scopedData.length) return;
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 48;

    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageWidth, 140, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(title || "Market Intelligence Report", margin, 70, { maxWidth: pageWidth - margin * 2 });

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    const preparedLabel = preparedFor ? `Prepared for: ${preparedFor}` : "Prepared for: Internal stakeholders";
    doc.text(preparedLabel, margin, 96);
    doc.text(`Generated on: ${generatedAt.toLocaleDateString()}`, margin, 114);
    doc.text(`Focus: ${focusCity || "All cities"} · ${timeframeLabel}`, margin, 132);

    let cursorY = 170;

    const writeSection = (heading, lines) => {
      if (!lines.length) return;
      const headingHeight = 20;
      const lineHeight = 16;
      if (cursorY + headingHeight + lines.length * lineHeight > pageHeight - margin) {
        doc.addPage();
        cursorY = margin;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235);
      doc.text(heading, margin, cursorY);
      cursorY += headingHeight;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.setTextColor(33, 37, 41);
      lines.forEach((line) => {
        doc.text(line, margin, cursorY, { maxWidth: pageWidth - margin * 2 });
        cursorY += lineHeight;
      });
      cursorY += 10;
    };

    if (sections.snapshot) {
      const snapshotLines = [
        `Listings analysed: ${summary.listings.toLocaleString()}`,
        `Average price: ${formatCurrency(summary.avgPrice)} (median ${formatCurrency(summary.medianPrice)})`,
        `Average mileage: ${summary.avgMileage ? `${Math.round(summary.avgMileage).toLocaleString()} km` : "Not available"}`,
        summary.avgDiscount != null
          ? `Average market discount: ${formatPercent(summary.avgDiscount)}`
          : "Average market discount: Not available",
        `Cities covered: ${summary.cities}`
      ];
      writeSection("Market snapshot", snapshotLines);
    }

    if (sections.brands && summary.brands.length) {
      const brandLines = summary.brands.map(
        (entry) =>
          `${entry.brand}: ${entry.listings.toLocaleString()} listings · ${formatCurrency(entry.avgPrice)} · ${
            entry.avgDiscount != null ? formatPercent(entry.avgDiscount) : "No discount data"
          }`
      );
      writeSection("Top performing brands", brandLines);
    }

    if (sections.body && summary.bodyTypes.length) {
      const bodyLines = summary.bodyTypes.map(
        (entry) => `${entry.body}: ${entry.listings.toLocaleString()} listings · ${formatPercent(entry.share)}`
      );
      writeSection("Body style distribution", bodyLines);
    }

    if (sections.insights && summary.insights.length) {
      writeSection("Strategic insights", summary.insights);
    }

    if (notes.trim()) {
      writeSection("Analyst notes", notes.trim().split(/\n+/));
    }

    doc.save(`${slugify(title)}-${slugify(focusCity || "all")}.pdf`);
  };

  return (
    <div className="container-fluid report-builder">
      <div className="row g-4">
        <div className="col-12 col-xl-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h2 className="card-title h4 mb-1">Configure report</h2>
              <p className="text-muted extra-small mb-0">
                Tailor the narrative, select focal regions, and choose which insights to include before exporting to PDF.
              </p>
            </div>
            <div className="card-body d-flex flex-column gap-3">
              <div>
                <label className="form-label" htmlFor="report-title">Report title</label>
                <input
                  id="report-title"
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Comprehensive Market Intelligence Report"
                />
              </div>

              <div>
                <label className="form-label" htmlFor="report-recipient">Prepared for</label>
                <input
                  id="report-recipient"
                  type="text"
                  className="form-control"
                  value={preparedFor}
                  onChange={(event) => setPreparedFor(event.target.value)}
                  placeholder="Executive leadership, client, or internal team"
                />
              </div>

              <div>
                <label className="form-label" htmlFor="report-city">Focus city</label>
                <select
                  id="report-city"
                  className="form-select"
                  value={focusCity}
                  onChange={(event) => setFocusCity(event.target.value)}
                >
                  <option value="">All cities</option>
                  {cityOptions.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label" htmlFor="report-timeframe">Time horizon</label>
                <select
                  id="report-timeframe"
                  className="form-select"
                  value={timeframe}
                  onChange={(event) => setTimeframe(event.target.value)}
                >
                  <option value="3m">Last 3 months</option>
                  <option value="6m">Last 6 months</option>
                  <option value="12m">Last 12 months</option>
                  <option value="ytd">Year to date</option>
                </select>
              </div>

              <fieldset className="border rounded-3 p-3">
                <legend className="float-none w-auto px-2 fs-6">Include sections</legend>
                <div className="form-check">
                  <input
                    id="section-snapshot"
                    className="form-check-input"
                    type="checkbox"
                    checked={sections.snapshot}
                    onChange={() => updateSection("snapshot")}
                  />
                  <label className="form-check-label" htmlFor="section-snapshot">
                    Market snapshot
                  </label>
                </div>
                <div className="form-check">
                  <input
                    id="section-brands"
                    className="form-check-input"
                    type="checkbox"
                    checked={sections.brands}
                    onChange={() => updateSection("brands")}
                  />
                  <label className="form-check-label" htmlFor="section-brands">
                    Top performing brands
                  </label>
                </div>
                <div className="form-check">
                  <input
                    id="section-body"
                    className="form-check-input"
                    type="checkbox"
                    checked={sections.body}
                    onChange={() => updateSection("body")}
                  />
                  <label className="form-check-label" htmlFor="section-body">
                    Body style distribution
                  </label>
                </div>
                <div className="form-check">
                  <input
                    id="section-insights"
                    className="form-check-input"
                    type="checkbox"
                    checked={sections.insights}
                    onChange={() => updateSection("insights")}
                  />
                  <label className="form-check-label" htmlFor="section-insights">
                    Strategic insights
                  </label>
                </div>
              </fieldset>

              <div>
                <label className="form-label" htmlFor="report-notes">Analyst notes</label>
                <textarea
                  id="report-notes"
                  className="form-control"
                  rows={4}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Summaries, action items, or recommendations to surface in the PDF."
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-body d-flex flex-column gap-4">
              <div className="report-preview__hero text-white rounded-4 p-4 p-lg-5">
                <div className="d-flex flex-column flex-lg-row justify-content-between align-items-start gap-4">
                  <div>
                    <p className="text-uppercase extra-small mb-2 opacity-75">{timeframeLabel}</p>
                    <h2 className="h3 mb-2">{title || "Comprehensive Market Intelligence Report"}</h2>
                    <p className="mb-0">
                      {preparedFor ? `Prepared for ${preparedFor}` : "Internal distribution"} · {focusCity || "All cities"}
                    </p>
                  </div>
                  <div className="report-preview__stat">
                    <span className="report-preview__stat-value">{summary.listings.toLocaleString()}</span>
                    <span className="report-preview__stat-label">Listings analysed</span>
                  </div>
                </div>
              </div>

              {!scopedData.length && (
                <div className="alert alert-warning mb-0" role="status">
                  No listings match the selected filters. Try switching the focus city or timeframe to populate the report.
                </div>
              )}

              {sections.snapshot && scopedData.length > 0 && (
                <section>
                  <header className="d-flex justify-content-between align-items-center mb-3">
                    <h3 className="h5 mb-0">Market snapshot</h3>
                    <span className="badge bg-primary-subtle text-primary">Overview</span>
                  </header>
                  <div className="report-preview__metrics">
                    <article>
                      <h4>Average price</h4>
                      <p>{formatCurrency(summary.avgPrice)}</p>
                      <span>Median {formatCurrency(summary.medianPrice)}</span>
                    </article>
                    <article>
                      <h4>Average mileage</h4>
                      <p>
                        {summary.avgMileage
                          ? `${Math.round(summary.avgMileage).toLocaleString()} km`
                          : "Not available"}
                      </p>
                      <span>{summary.cities} active cities</span>
                    </article>
                    <article>
                      <h4>Market discount</h4>
                      <p>{summary.avgDiscount != null ? formatPercent(summary.avgDiscount) : "Not available"}</p>
                      <span>Based on advertised vs. market price deltas</span>
                    </article>
                  </div>
                </section>
              )}

              {sections.brands && scopedData.length > 0 && summary.brands.length > 0 && (
                <section>
                  <header className="d-flex justify-content-between align-items-center mb-3">
                    <h3 className="h5 mb-0">Top performing brands</h3>
                    <span className="badge bg-info-subtle text-info">Demand pulse</span>
                  </header>
                  <div className="report-preview__list">
                    {summary.brands.map((brand) => (
                      <div key={brand.brand} className="report-preview__list-item">
                        <div>
                          <h4 className="h6 mb-1">{brand.brand}</h4>
                          <p className="mb-0 extra-small text-muted">
                            {brand.listings.toLocaleString()} listings · {formatCurrency(brand.avgPrice)}
                          </p>
                        </div>
                        <span className="badge bg-primary-subtle text-primary fw-semibold">
                          {brand.avgDiscount != null ? formatPercent(brand.avgDiscount) : "n/a"}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {sections.body && scopedData.length > 0 && summary.bodyTypes.length > 0 && (
                <section>
                  <header className="d-flex justify-content-between align-items-center mb-3">
                    <h3 className="h5 mb-0">Body style distribution</h3>
                    <span className="badge bg-warning-subtle text-warning">Mix</span>
                  </header>
                  <div className="report-preview__list">
                    {summary.bodyTypes.map((body) => (
                      <div key={body.body} className="report-preview__list-item">
                        <div>
                          <h4 className="h6 mb-1">{body.body}</h4>
                          <p className="mb-0 extra-small text-muted">
                            {body.listings.toLocaleString()} listings
                          </p>
                        </div>
                        <span className="badge bg-warning-subtle text-warning fw-semibold">
                          {formatPercent(body.share)}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {sections.insights && scopedData.length > 0 && summary.insights.length > 0 && (
                <section>
                  <header className="d-flex justify-content-between align-items-center mb-3">
                    <h3 className="h5 mb-0">Strategic insights</h3>
                    <span className="badge bg-success-subtle text-success">Opportunities</span>
                  </header>
                  <ul className="report-preview__insights">
                    {summary.insights.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {notes.trim() && (
                <section>
                  <header className="d-flex justify-content-between align-items-center mb-3">
                    <h3 className="h5 mb-0">Analyst notes</h3>
                    <span className="badge bg-secondary-subtle text-secondary">Commentary</span>
                  </header>
                  <p className="mb-0 report-preview__notes">{notes}</p>
                </section>
              )}

              <div className="d-flex justify-content-end mt-auto">
                <button
                  type="button"
                  className="btn btn-primary btn-lg"
                  onClick={handleDownload}
                  disabled={!scopedData.length}
                >
                  Download PDF report
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

