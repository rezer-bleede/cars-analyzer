import React, { useMemo } from "react";
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar } from "recharts";
import { groupBy, safeAvg } from "../utils";

export default function Charts({ data }) {
  // Price vs Year: only rows with both year & price
  const scatterData = useMemo(() => {
    return data
      .filter(d => Number.isFinite(d.price) && Number.isFinite(d.details_year))
      .map(d => ({
        x: Number(d.details_year),
        y: Number(d.price),
        title: d.title_en ?? "",
        city: d.city_inferred ?? "",
        make: d.details_make || guessMake(d) // optional make guess
      }));
  }, [data]);

  // Make distribution: average price by Make (use details_make if present; else derive from title)
  const byMake = useMemo(() => {
    const rows = data.map(d => ({
      make: (d.details_make || guessMake(d) || "Unknown"),
      price: Number(d.price)
    })).filter(r => Number.isFinite(r.price));
    const g = groupBy(rows, r => r.make);
    const out = Object.keys(g).map(k => ({ make: k, avgPrice: safeAvg(g[k].map(x => x.price)) || 0 }));
    // sort top 15
    return out.sort((a,b) => b.avgPrice - a.avgPrice).slice(0, 15);
  }, [data]);

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
    </>
  );
}

// crude fallback if you didn't flatten details_make yet
function guessMake(d) {
  // try to take first word of title as make (very rough)
  const t = (d.title_en || "").trim();
  const w = t.split(/\s+/)[0];
  if (!w) return null;
  // capitalize
  return w[0].toUpperCase() + w.slice(1).toLowerCase();
}
