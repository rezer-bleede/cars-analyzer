import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
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
import { groupBy, safeAvg } from "../utils";

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

export default function Charts({ data }) {
  const totalListings = data.length;

  const yearScatterData = useMemo(() => {
    return data
      .filter((row) => Number.isFinite(row.price) && Number.isFinite(row.details_year))
      .map((row) => ({
        year: Number(row.details_year),
        price: Number(row.price),
        make: row.details_make || row.brand || "Unknown",
        city: row.city_inferred || "Unknown"
      }));
  }, [data]);

  const mileageScatterData = useMemo(() => {
    return data
      .filter((row) => Number.isFinite(row.price) && Number.isFinite(row.details_kilometers))
      .map((row) => ({
        kilometers: Number(row.details_kilometers),
        price: Number(row.price),
        make: row.details_make || row.brand || "Unknown",
        year: Number(row.details_year) || null
      }));
  }, [data]);

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
  const formatPercent = (value) => `${(value ?? 0).toFixed(1)}%`;

  return (
    <div className="container-fluid">
      <div className="row g-4">
        <div className="col-12">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h4 mb-1">Price vs model year</h3>
              <p className="text-muted extra-small mb-0">
                Each dot represents an individual listing; hover to inspect its make and location.
              </p>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 380 }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5f5" />
                    <XAxis dataKey="year" name="Model year" tick={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="price"
                      name="Price (AED)"
                      tickFormatter={(value) => `AED ${Math.round(value / 1000)}k`}
                    />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "price") {
                          return [formatCurrency(value), "Price"];
                        }
                        return [value, "Year"];
                      }}
                      labelFormatter={(_, payload) => {
                        const entry = payload?.[0]?.payload;
                        if (!entry) return "";
                        return `${entry.make} · ${entry.city}`;
                      }}
                    />
                    <Scatter data={yearScatterData} fill="#2563eb" />
                  </ScatterChart>
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

        <div className="col-12 col-xl-6">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-white border-0 pb-0">
              <h3 className="card-title h4 mb-1">Price vs mileage</h3>
              <p className="text-muted extra-small mb-0">Mileage influence on price for vehicles with recorded odometer readings.</p>
            </div>
            <div className="card-body">
              <div style={{ width: "100%", height: 360 }}>
                <ResponsiveContainer>
                  <ScatterChart margin={{ top: 16, right: 24, bottom: 16, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#cbd5f5" />
                    <XAxis
                      dataKey="kilometers"
                      name="Mileage (km)"
                      tickFormatter={(value) => `${Math.round(value / 1000)}k`}
                    />
                    <YAxis dataKey="price" name="Price (AED)" tickFormatter={(value) => `AED ${Math.round(value / 1000)}k`} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === "price") {
                          return [formatCurrency(value), "Price"];
                        }
                        return [`${Math.round(value / 1000)}k`, "Mileage"];
                      }}
                      labelFormatter={(_, payload) => {
                        const entry = payload?.[0]?.payload;
                        if (!entry) return "";
                        return entry.year ? `${entry.make} · ${entry.year}` : entry.make;
                      }}
                    />
                    <Scatter data={mileageScatterData} fill="#f97316" />
                  </ScatterChart>
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
