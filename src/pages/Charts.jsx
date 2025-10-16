import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Line,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart
} from "recharts";
import { deriveBrand, deriveModel, groupBy, safeAvg } from "../utils";

const COLOR_PALETTE = [
  "#2563eb",
  "#0ea5e9",
  "#10b981",
  "#f97316",
  "#f43f5e",
  "#a855f7",
  "#facc15",
  "#22d3ee",
  "#8b5cf6",
  "#14b8a6"
];

const clampPercent = (value) => {
  if (!Number.isFinite(value)) return null;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const formatPercentText = (value) => {
  if (!Number.isFinite(value)) return "–";
  return `${value.toFixed(1)}%`;
};

const linearRegression = (points) => {
  if (!Array.isArray(points) || points.length < 2) return null;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (const { x, y } of points) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = points.length * sumXX - sumX * sumX;
  if (Math.abs(denom) < 1e-6) return null;
  const slope = (points.length * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / points.length;
  if (!Number.isFinite(slope) || !Number.isFinite(intercept)) return null;
  return { slope, intercept };
};

const computePercentLoss = ({ slope, intercept }) => {
  if (!Number.isFinite(slope) || !Number.isFinite(intercept) || intercept <= 0) return null;
  const percent = (-slope / intercept) * 100;
  if (!Number.isFinite(percent)) return null;
  return percent;
};

export default function Charts({ data }) {
  const totalListings = data.length;

  const depreciationStats = useMemo(() => {
    if (!data.length) {
      return { most: [], least: [], brandModels: new Map() };
    }
    const nowYear = new Date().getFullYear();
    const normalized = data
      .map((row) => {
        const price = Number(row.price);
        const year = Number(row.details_year);
        const brand = deriveBrand(row) || row.details_make || row.brand || "";
        const model = deriveModel(row) || row.details_model || row.model || "";
        if (!Number.isFinite(price) || price <= 0) return null;
        if (!Number.isFinite(year)) return null;
        const trimmedBrand = brand.trim();
        const trimmedModel = model.trim();
        if (!trimmedBrand || !trimmedModel) return null;
        const cappedYear = Math.max(1980, Math.min(nowYear + 1, year));
        const age = Math.max(0, Math.min(30, nowYear - cappedYear));
        return { brand: trimmedBrand, model: trimmedModel, price, age };
      })
      .filter(Boolean);

    const groupedByBrand = groupBy(normalized, (item) => item.brand);
    const brandModels = new Map();
    const brandEntries = [];

    for (const [brand, items] of Object.entries(groupedByBrand)) {
      const points = items.map((item) => ({ x: item.age, y: item.price }));
      if (points.length < 5) continue;
      const regression = linearRegression(points);
      if (!regression) continue;
      const percentLoss = computePercentLoss(regression);
      if (percentLoss == null) continue;
      const modelsGrouped = groupBy(items, (item) => item.model);
      const modelEntries = Object.entries(modelsGrouped)
        .map(([model, rows]) => {
          const modelPoints = rows.map((row) => ({ x: row.age, y: row.price }));
          if (modelPoints.length < 3) return null;
          const modelRegression = linearRegression(modelPoints);
          if (!modelRegression) return null;
          const modelPercentLoss = computePercentLoss(modelRegression);
          if (modelPercentLoss == null) return null;
          return {
            model,
            sampleCount: modelPoints.length,
            percentLoss: modelPercentLoss,
            displayPercent: clampPercent(modelPercentLoss)
          };
        })
        .filter(Boolean);

      if (!modelEntries.length) continue;

      const averagePrice = safeAvg(items.map((item) => item.price)) || 0;

      brandModels.set(brand, {
        most: [...modelEntries].sort((a, b) => b.percentLoss - a.percentLoss).slice(0, 5),
        least: [...modelEntries].sort((a, b) => a.percentLoss - b.percentLoss).slice(0, 5)
      });

      brandEntries.push({
        brand,
        sampleCount: points.length,
        percentLoss,
        displayPercent: clampPercent(percentLoss),
        averagePrice
      });
    }

    const most = [...brandEntries].sort((a, b) => b.percentLoss - a.percentLoss).slice(0, 5);
    const least = [...brandEntries].sort((a, b) => a.percentLoss - b.percentLoss).slice(0, 5);

    return { most, least, brandModels };
  }, [data]);

  const [activeMostBrand, setActiveMostBrand] = useState("");
  const [activeLeastBrand, setActiveLeastBrand] = useState("");

  useEffect(() => {
    setActiveMostBrand((current) => {
      if (current && depreciationStats.most.some((entry) => entry.brand === current)) {
        return current;
      }
      return depreciationStats.most[0]?.brand || "";
    });
  }, [depreciationStats.most]);

  useEffect(() => {
    setActiveLeastBrand((current) => {
      if (current && depreciationStats.least.some((entry) => entry.brand === current)) {
        return current;
      }
      return depreciationStats.least[0]?.brand || "";
    });
  }, [depreciationStats.least]);

  const priceByMake = useMemo(() => {
    const rows = data
      .map((row) => ({
        make: row.details_make || row.brand || "Unknown",
        price: Number(row.price)
      }))
      .filter((row) => Number.isFinite(row.price));
    const grouped = groupBy(rows, (row) => row.make);
    return Object.entries(grouped)
      .map(([make, values]) => ({
        make,
        avgPrice: safeAvg(values.map((item) => item.price)) || 0,
        count: values.length
      }))
      .filter((entry) => entry.count >= 5)
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 12);
  }, [data]);

  const bodyTypeShare = useMemo(() => {
    const grouped = groupBy(
      data.map((row) => {
        const value = row.details_body_type || row.body_type || "Unknown";
        return typeof value === "string" && value.trim() ? value.trim() : "Unknown";
      }),
      (value) => value
    );
    return Object.entries(grouped)
      .map(([body, values]) => ({
        body,
        count: values.length,
        share: totalListings ? (values.length / totalListings) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [data, totalListings]);

  const discountByMake = useMemo(() => {
    const rows = data
      .map((row) => ({
        make: row.details_make || row.brand || "Unknown",
        discount: Number(row.market_discount_pct)
      }))
      .filter((row) => Number.isFinite(row.discount));
    const grouped = groupBy(rows, (row) => row.make);
    return Object.entries(grouped)
      .map(([make, values]) => ({
        make,
        avgDiscount: safeAvg(values.map((item) => item.discount)) || 0,
        samples: values.length
      }))
      .filter((entry) => entry.samples >= 5)
      .sort((a, b) => b.avgDiscount - a.avgDiscount)
      .slice(0, 10);
  }, [data]);

  const priceVolumeByDate = useMemo(() => {
    const grouped = groupBy(
      data.filter((row) => Number.isFinite(row.created_at_epoch_ms)),
      (row) => new Date(row.created_at_epoch_ms).toISOString().slice(0, 10)
    );
    return Object.entries(grouped)
      .map(([date, values]) => {
        const priceValues = values
          .map((row) => Number(row.price))
          .filter((value) => Number.isFinite(value));
        return {
          date,
          avgPrice: priceValues.length ? safeAvg(priceValues) : 0,
          count: values.length
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const latestSnapshot = priceVolumeByDate[priceVolumeByDate.length - 1];

  const formatCurrency = (value) => `AED ${Math.round(value ?? 0).toLocaleString("en-US")}`;
  const formatPercent = (value) => `${Number(value ?? 0).toFixed(1)}%`;

  const activeMostBrandMeta = depreciationStats.most.find((entry) => entry.brand === activeMostBrand);
  const activeLeastBrandMeta = depreciationStats.least.find((entry) => entry.brand === activeLeastBrand);
  const activeMostModels = depreciationStats.brandModels.get(activeMostBrand)?.most || [];
  const activeLeastModels = depreciationStats.brandModels.get(activeLeastBrand)?.least || [];

  return (
    <div className="container-fluid">
      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h4 mb-1">Top 5 most depreciating car brands</h3>
              <p className="text-muted extra-small mb-0">
                Annualised value loss calculated from price vs age regression (min. 5 listings per brand).
              </p>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={depreciationStats.most} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={formatPercentText} domain={[0, "dataMax"]} />
                    <YAxis type="category" dataKey="brand" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value, _name, payload) => [formatPercentText(value), `${payload?.payload?.sampleCount ?? 0} listings`]}
                    />
                    <Bar dataKey="displayPercent" radius={[0, 8, 8, 0]}>
                      {depreciationStats.most.map((entry) => (
                        <Cell
                          key={entry.brand}
                          cursor="pointer"
                          fill={entry.brand === activeMostBrand ? "#f43f5e" : "#fecdd3"}
                          onClick={() => setActiveMostBrand(entry.brand)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="list-group list-group-flush mt-3">
                {depreciationStats.most.length === 0 && (
                  <div className="text-muted extra-small">Not enough data to calculate depreciation trends.</div>
                )}
                {depreciationStats.most.map((entry) => (
                  <button
                    type="button"
                    key={entry.brand}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2 ${
                      entry.brand === activeMostBrand ? "active" : ""
                    }`}
                    onClick={() => setActiveMostBrand(entry.brand)}
                    aria-pressed={entry.brand === activeMostBrand}
                  >
                    <div className="text-start">
                      <div className="fw-semibold">{entry.brand}</div>
                      <div className="text-muted extra-small">{entry.sampleCount.toLocaleString()} listings · Avg price {formatCurrency(entry.averagePrice)}</div>
                    </div>
                    <span className="badge bg-danger-subtle text-danger fw-semibold">
                      {formatPercent(entry.displayPercent)} / yr
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-3">
                {activeMostBrandMeta ? (
                  <div className="p-3 rounded-3 bg-danger-subtle text-danger d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                      <div>
                        <h4 className="h6 mb-1">{activeMostBrandMeta.brand}</h4>
                        <p className="extra-small mb-0 text-danger">
                          Losing approximately {formatPercent(activeMostBrandMeta.displayPercent)} of value per year.
                        </p>
                      </div>
                      <span className="badge bg-white text-danger fw-semibold">
                        {activeMostBrandMeta.sampleCount.toLocaleString()} listings analysed
                      </span>
                    </div>
                    <div>
                      <h5 className="h6 text-danger mb-2">Most depreciating models</h5>
                      {activeMostModels.length ? (
                        <ul className="list-group list-group-flush bg-transparent">
                          {activeMostModels.map((model) => (
                            <li
                              key={`${activeMostBrandMeta.brand}-${model.model}`}
                              className="list-group-item bg-transparent px-0 d-flex justify-content-between align-items-center gap-3"
                            >
                              <div>
                                <span className="fw-semibold text-danger">{model.model}</span>
                                <div className="extra-small text-danger opacity-75">{model.sampleCount.toLocaleString()} listings</div>
                              </div>
                              <span className="badge bg-danger text-white">{formatPercent(model.displayPercent)} / yr</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="extra-small mb-0 text-danger">No model-level insights yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted extra-small mb-0">Select a brand above to explore model-level depreciation.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h4 mb-1">Top 5 least depreciating car brands</h3>
              <p className="text-muted extra-small mb-0">
                Brands retaining value best based on annualised loss (min. 5 listings per brand).
              </p>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <BarChart data={depreciationStats.least} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={formatPercentText} domain={[0, "dataMax"]} />
                    <YAxis type="category" dataKey="brand" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip
                      formatter={(value, _name, payload) => [formatPercentText(value), `${payload?.payload?.sampleCount ?? 0} listings`]}
                    />
                    <Bar dataKey="displayPercent" radius={[0, 8, 8, 0]}>
                      {depreciationStats.least.map((entry) => (
                        <Cell
                          key={entry.brand}
                          cursor="pointer"
                          fill={entry.brand === activeLeastBrand ? "#10b981" : "#bbf7d0"}
                          onClick={() => setActiveLeastBrand(entry.brand)}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="list-group list-group-flush mt-3">
                {depreciationStats.least.length === 0 && (
                  <div className="text-muted extra-small">Not enough data to calculate depreciation trends.</div>
                )}
                {depreciationStats.least.map((entry) => (
                  <button
                    type="button"
                    key={entry.brand}
                    className={`list-group-item list-group-item-action d-flex justify-content-between align-items-center gap-2 ${
                      entry.brand === activeLeastBrand ? "active" : ""
                    }`}
                    onClick={() => setActiveLeastBrand(entry.brand)}
                    aria-pressed={entry.brand === activeLeastBrand}
                  >
                    <div className="text-start">
                      <div className="fw-semibold">{entry.brand}</div>
                      <div className="text-muted extra-small">{entry.sampleCount.toLocaleString()} listings · Avg price {formatCurrency(entry.averagePrice)}</div>
                    </div>
                    <span className="badge bg-success-subtle text-success fw-semibold">
                      {formatPercent(entry.displayPercent)} / yr
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-3">
                {activeLeastBrandMeta ? (
                  <div className="p-3 rounded-3 bg-success-subtle text-success d-flex flex-column gap-2">
                    <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                      <div>
                        <h4 className="h6 mb-1">{activeLeastBrandMeta.brand}</h4>
                        <p className="extra-small mb-0 text-success">
                          Holding onto value with only {formatPercent(activeLeastBrandMeta.displayPercent)} annual loss.
                        </p>
                      </div>
                      <span className="badge bg-white text-success fw-semibold">
                        {activeLeastBrandMeta.sampleCount.toLocaleString()} listings analysed
                      </span>
                    </div>
                    <div>
                      <h5 className="h6 text-success mb-2">Most resilient models</h5>
                      {activeLeastModels.length ? (
                        <ul className="list-group list-group-flush bg-transparent">
                          {activeLeastModels.map((model) => (
                            <li
                              key={`${activeLeastBrandMeta.brand}-${model.model}`}
                              className="list-group-item bg-transparent px-0 d-flex justify-content-between align-items-center gap-3"
                            >
                              <div>
                                <span className="fw-semibold text-success">{model.model}</span>
                                <div className="extra-small text-success opacity-75">{model.sampleCount.toLocaleString()} listings</div>
                              </div>
                              <span className="badge bg-success text-white">{formatPercent(model.displayPercent)} / yr</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="extra-small mb-0 text-success">No model-level insights yet.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted extra-small mb-0">Select a brand above to explore model-level retention.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h4 mb-1">Average price by make</h3>
              <p className="text-muted extra-small mb-0">Top 12 makes with at least 5 active listings.</p>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <BarChart data={priceByMake} layout="vertical" margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={formatCurrency} />
                    <YAxis type="category" dataKey="make" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [formatCurrency(value), "Average price"]} />
                    <Bar dataKey="avgPrice" radius={[0, 8, 8, 0]} fill="#2563eb" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h4 mb-1">Body type share</h3>
              <p className="text-muted extra-small mb-0">Share of listings by body configuration.</p>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Tooltip formatter={(value, name, { payload }) => [formatPercent(payload.share), name]} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Pie data={bodyTypeShare} dataKey="share" nameKey="body" innerRadius={60} outerRadius={110} paddingAngle={4}>
                      {bodyTypeShare.map((entry, index) => (
                        <Cell key={entry.body} fill={COLOR_PALETTE[index % COLOR_PALETTE.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h4 mb-1">Average market discount by make</h3>
              <p className="text-muted extra-small mb-0">Shows makes with at least 5 comparable listings.</p>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <BarChart data={discountByMake} layout="vertical" margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" tickFormatter={formatPercent} />
                    <YAxis type="category" dataKey="make" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [formatPercent(value), "Avg discount"]} />
                    <Bar dataKey="avgDiscount" radius={[0, 8, 8, 0]} fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h4 mb-1">Price and volume over time</h3>
              <p className="text-muted extra-small mb-0">Daily trend combining the average asking price with listing volume.</p>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <ComposedChart data={priceVolumeByDate} margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tickFormatter={(value) => `AED ${Math.round(value / 1000)}k`} />
                    <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => value.toLocaleString()} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "avgPrice") {
                          return [formatCurrency(value), "Average price"];
                        }
                        return [value.toLocaleString(), "Listings"];
                      }}
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="count"
                      name="Listings"
                      fill="rgba(37, 99, 235, 0.15)"
                      stroke="#93c5fd"
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="avgPrice"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      name="Average price"
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {latestSnapshot && (
                <p className="text-muted extra-small mb-0 mt-3">
                  Latest day {latestSnapshot.date}: {formatCurrency(latestSnapshot.avgPrice)} across {latestSnapshot.count.toLocaleString()} listings.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
