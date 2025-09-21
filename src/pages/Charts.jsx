import React, { useMemo } from "react";
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, LineChart, Line
} from "recharts";
import { groupBy, safeAvg } from "../utils";

export default function Charts({ data }) {
  // Price vs Year
  const scatterData = useMemo(() => {
    return data
      .filter(d => Number.isFinite(d.price) && Number.isFinite(d.details_year))
      .map(d => ({
        x: Number(d.details_year),
        y: Number(d.price),
        title: d.title_en ?? "",
        city: d.city_inferred ?? "",
        make: d.details_make || guessMake(d)
      }));
  }, [data]);

  // Avg price by Make (Top 15)
  const byMake = useMemo(() => {
    const rows = data.map(d => ({
      make: (d.details_make || guessMake(d) || "Unknown"),
      price: Number(d.price)
    })).filter(r => Number.isFinite(r.price));
    const g = groupBy(rows, r => r.make);
    const out = Object.keys(g).map(k => ({ make: k, avgPrice: safeAvg(g[k].map(x => x.price)) || 0 }));
    return out.sort((a,b) => b.avgPrice - a.avgPrice).slice(0, 15);
  }, [data]);

  // Average price over time (by day) from actual timestamps
  const byDate = useMemo(() => {
    const rows = data.filter(d => Number.isFinite(d.created_at_epoch_ms) && Number.isFinite(d.price));
    const g = groupBy(rows, d => new Date(d.created_at_epoch_ms).toISOString().slice(0,10)); // YYYY-MM-DD
    const out = Object.keys(g).map(date => ({
      date,
      avgPrice: safeAvg(g[date].map(x => x.price))
    })).sort((a,b) => a.date.localeCompare(b.date));
    return out;
  }, [data]);

  const latestDate = byDate.length ? byDate[byDate.length - 1].date : null;
  const latestPoint = latestDate ? byDate.filter(p => p.date === latestDate) : [];

  return (
    <>
      <h1>Charts</h1>

      <section className="card chart-card">
        <h3>Price vs Year</h3>
        <div style={{width:"100%", height:360}}>
          <ResponsiveContainer>
            <ScatterChart>
              <CartesianGrid />
              <XAxis dataKey="x" name="Year" />
              <YAxis dataKey="y" name="Price (AED)" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [n === "y" ? `AED ${v}` : v, n === "y" ? "Price" : "Year"]} />
              <Scatter data={scatterData} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card chart-card">
        <h3>Average Price by Make (Top 15)</h3>
        <div style={{width:"100%", height:360}}>
          <ResponsiveContainer>
            <BarChart data={byMake}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="make" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="avgPrice" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card chart-card">
        <h3>Average Price Over Time (by day)</h3>
        <div style={{width:"100%", height:360}}>
          <ResponsiveContainer>
            <LineChart data={byDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line dataKey="avgPrice" dot={false} />
              {/* highlight the most recent day's point */}
              {latestPoint.length > 0 && (
                <Scatter data={latestPoint} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {latestDate && <div className="footer">Highlighted latest day: <b>{latestDate}</b></div>}
      </section>
    </>
  );
}

function guessMake(d) {
  const t = (d.title_en || "").trim();
  const w = t.split(/\s+/)[0];
  if (!w) return null;
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}
