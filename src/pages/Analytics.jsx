import React, { useMemo, useState } from "react";
import { fmtPrice } from "../utils";

const AGGREGATORS = [
  { value: "count", label: "Count", needsField: false },
  { value: "avg", label: "Average", needsField: true },
  { value: "sum", label: "Sum", needsField: true },
  { value: "min", label: "Minimum", needsField: true },
  { value: "max", label: "Maximum", needsField: true }
];

const METRIC_FIELDS = [
  { value: "price", label: "Price (AED)", type: "currency", aggregators: ["avg", "sum", "min", "max"] },
  { value: "market_diff", label: "Market Discount (AED)", type: "currency", aggregators: ["avg", "sum", "min", "max"] },
  { value: "market_avg", label: "Market Average (AED)", type: "currency", aggregators: ["avg", "sum", "min", "max"] },
  { value: "market_discount_pct", label: "Market Discount %", type: "percent", aggregators: ["avg", "min", "max"] },
  { value: "details_year", label: "Year", type: "number", aggregators: ["avg", "min", "max"] },
  { value: "details_kilometers", label: "Mileage (km)", type: "number", aggregators: ["avg", "min", "max"] },
  { value: "market_count", label: "Market Sample Size", type: "number", aggregators: ["avg", "sum", "min", "max"] }
];

const FILTER_FIELDS = [
  { value: "details_make", label: "Make", type: "string" },
  { value: "details_model", label: "Model", type: "string" },
  { value: "details_body_type", label: "Body", type: "string" },
  { value: "city_inferred", label: "City", type: "string" },
  { value: "details_seller_type", label: "Seller Type", type: "string" },
  { value: "details_regional_specs", label: "Regional Specs", type: "string" },
  { value: "source", label: "Source", type: "string" },
  { value: "details_year", label: "Year", type: "number" },
  { value: "price", label: "Price (AED)", type: "number" },
  { value: "market_diff", label: "Market Discount (AED)", type: "number" },
  { value: "market_discount_pct", label: "Market Discount %", type: "number" },
  { value: "details_kilometers", label: "Mileage (km)", type: "number" }
];

const STRING_OPERATORS = [
  { value: "equals", label: "is" },
  { value: "not_equals", label: "is not" },
  { value: "contains", label: "contains" }
];

const NUMBER_OPERATORS = [
  { value: "eq", label: "=" },
  { value: "gte", label: ">=" },
  { value: "gt", label: ">" },
  { value: "lte", label: "<=" },
  { value: "lt", label: "<" }
];

const fieldMetaByValue = METRIC_FIELDS.reduce((acc, field) => {
  acc[field.value] = field;
  return acc;
}, {});

FILTER_FIELDS.forEach((field) => {
  if (!fieldMetaByValue[field.value]) {
    fieldMetaByValue[field.value] = field;
  }
});

let internalId = 0;
const nextId = (prefix) => `${prefix}-${++internalId}`;

const aggregatorNeedsField = (agg) => AGGREGATORS.find((a) => a.value === agg)?.needsField;

const compatibleMetricFields = (aggregator) =>
  METRIC_FIELDS.filter((field) => field.aggregators.includes(aggregator));

const defaultMetricForAggregator = (aggregator) => {
  const compatible = compatibleMetricFields(aggregator);
  return compatible.length ? compatible[0].value : null;
};

const defaultOperatorForType = (type) => (type === "number" ? "gte" : "equals");

const normalizeNumeric = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const computeKpi = (kpi, rows) => {
  if (!Array.isArray(rows) || !rows.length) {
    return { value: null, formatted: "—", matches: 0 };
  }

  const filteredRows = kpi.filters.reduce((accRows, filter) => {
    if (!filter.field) return accRows;
    const meta = fieldMetaByValue[filter.field] || { type: "string" };
    const operator = filter.operator || defaultOperatorForType(meta.type);
    const rawValue = filter.value;
    if (rawValue == null || rawValue === "") return accRows;

    const compareValue = meta.type === "number" ? normalizeNumeric(rawValue) : String(rawValue).toLowerCase();
    if (meta.type === "number" && compareValue == null) return [];

    return accRows.filter((row) => {
      const cell = row[filter.field];
      if (meta.type === "number") {
        const n = normalizeNumeric(cell);
        if (n == null) return false;
        switch (operator) {
          case "eq":
            return n === compareValue;
          case "gte":
            return n >= compareValue;
          case "gt":
            return n > compareValue;
          case "lte":
            return n <= compareValue;
          case "lt":
            return n < compareValue;
          default:
            return false;
        }
      }

      const text = String(cell ?? "").toLowerCase();
      switch (operator) {
        case "equals":
          return text === compareValue;
        case "not_equals":
          return text !== compareValue;
        case "contains":
          return text.includes(compareValue);
        default:
          return false;
      }
    });
  }, rows);

  const matches = filteredRows.length;
  if (kpi.aggregator === "count" || !aggregatorNeedsField(kpi.aggregator)) {
    return { value: matches, formatted: matches.toLocaleString("en-US"), matches };
  }

  const values = filteredRows
    .map((row) => normalizeNumeric(row[kpi.field]))
    .filter((value) => value != null);

  if (!values.length) {
    return { value: null, formatted: "—", matches };
  }

  let value = null;
  switch (kpi.aggregator) {
    case "sum":
      value = values.reduce((sum, v) => sum + v, 0);
      break;
    case "avg":
      value = values.reduce((sum, v) => sum + v, 0) / values.length;
      break;
    case "min":
      value = Math.min(...values);
      break;
    case "max":
      value = Math.max(...values);
      break;
    default:
      value = null;
  }

  if (value == null) {
    return { value: null, formatted: "—", matches };
  }

  const fieldMeta = fieldMetaByValue[kpi.field] || { type: "number" };
  let formatted = "";
  if (fieldMeta.type === "currency") {
    formatted = fmtPrice(Math.round(value));
  } else if (fieldMeta.type === "percent") {
    formatted = `${value.toFixed(1)}%`;
  } else {
    const precision = Math.abs(value) >= 100 ? 0 : 2;
    formatted = Number(value).toLocaleString("en-US", { maximumFractionDigits: precision });
  }

  return { value, formatted, matches };
};

const buildFilterOptions = (data) => {
  const options = {};
  for (const field of FILTER_FIELDS) {
    if (field.type !== "string") continue;
    const values = new Set();
    for (const row of data) {
      const v = row[field.value];
      if (v == null || v === "") continue;
      const label = String(v).trim();
      if (label) values.add(label);
    }
    options[field.value] = Array.from(values).sort((a, b) => a.localeCompare(b));
  }
  return options;
};

const Analytics = ({ data }) => {
  const [kpis, setKpis] = useState(() => [
    {
      id: nextId("kpi"),
      name: "Active listings",
      aggregator: "count",
      field: null,
      filters: []
    }
  ]);

  const suggestions = useMemo(() => buildFilterOptions(data), [data]);

  const kpiResults = useMemo(
    () =>
      kpis.map((kpi) => ({
        id: kpi.id,
        result: computeKpi(kpi, data)
      })),
    [kpis, data]
  );

  const datasetSize = data.length;

  const summary = useMemo(() => {
    if (!data.length) {
      return {
        averagePrice: 0,
        medianPrice: 0,
        averageDiscount: 0,
        distinctMakes: 0,
        recentListings: 0
      };
    }

    const priceValues = data
      .map((row) => Number(row.price))
      .filter((value) => Number.isFinite(value))
      .sort((a, b) => a - b);

    const averagePrice = priceValues.length
      ? priceValues.reduce((sum, value) => sum + value, 0) / priceValues.length
      : 0;

    const medianPrice = priceValues.length
      ? priceValues[Math.floor(priceValues.length / 2)]
      : 0;

    const discountValues = data
      .map((row) => Number(row.market_discount_pct))
      .filter((value) => Number.isFinite(value));

    const averageDiscount = discountValues.length
      ? discountValues.reduce((sum, value) => sum + value, 0) / discountValues.length
      : 0;

    const makes = new Set(
      data
        .map((row) => row.details_make || row.brand)
        .filter((value) => typeof value === "string" && value.trim())
    );

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentListings = data.filter((row) => {
      const ts = Number(row.created_at_epoch_ms);
      return Number.isFinite(ts) && ts >= sevenDaysAgo;
    }).length;

    return {
      averagePrice,
      medianPrice,
      averageDiscount,
      distinctMakes: makes.size,
      recentListings
    };
  }, [data]);

  const topMakes = useMemo(() => {
    const aggregates = new Map();
    data.forEach((row) => {
      const make = (row.details_make || row.brand || "Unknown").trim() || "Unknown";
      const price = Number(row.price);
      const discount = Number(row.market_discount_pct);
      const entry = aggregates.get(make) || {
        make,
        count: 0,
        priceTotal: 0,
        discountTotal: 0,
        discountSamples: 0
      };
      entry.count += 1;
      if (Number.isFinite(price)) {
        entry.priceTotal += price;
      }
      if (Number.isFinite(discount)) {
        entry.discountTotal += discount;
        entry.discountSamples += 1;
      }
      aggregates.set(make, entry);
    });

    return Array.from(aggregates.values())
      .filter((entry) => entry.count >= 3)
      .map((entry) => ({
        make: entry.make,
        count: entry.count,
        averagePrice: entry.priceTotal / entry.count || 0,
        averageDiscount: entry.discountSamples
          ? entry.discountTotal / entry.discountSamples
          : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data]);

  const topCities = useMemo(() => {
    const aggregates = new Map();
    data.forEach((row) => {
      const city = (row.city_inferred || "Unknown").trim() || "Unknown";
      const price = Number(row.price);
      const entry = aggregates.get(city) || {
        city,
        count: 0,
        priceTotal: 0
      };
      entry.count += 1;
      if (Number.isFinite(price)) {
        entry.priceTotal += price;
      }
      aggregates.set(city, entry);
    });

    return Array.from(aggregates.values())
      .filter((entry) => entry.count >= 3)
      .map((entry) => ({
        city: entry.city,
        count: entry.count,
        averagePrice: entry.priceTotal / entry.count || 0,
        share: datasetSize ? (entry.count / datasetSize) * 100 : 0
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [data, datasetSize]);

  const updateKpi = (id, updater) => {
    setKpis((prev) =>
      prev.map((kpi) => (kpi.id === id ? { ...kpi, ...updater(kpi) } : kpi))
    );
  };

  const addKpi = () => {
    const defaultAgg = "avg";
    const field = defaultMetricForAggregator(defaultAgg);
    setKpis((prev) => [
      ...prev,
      {
        id: nextId("kpi"),
        name: "New KPI",
        aggregator: field ? defaultAgg : "count",
        field: field ?? null,
        filters: []
      }
    ]);
  };

  const removeKpi = (id) => {
    setKpis((prev) => (prev.length > 1 ? prev.filter((kpi) => kpi.id !== id) : prev));
  };

  const addFilter = (kpiId) => {
    setKpis((prev) =>
      prev.map((kpi) =>
        kpi.id === kpiId
          ? {
              ...kpi,
              filters: [
                ...kpi.filters,
                {
                  id: nextId("filter"),
                  field: "",
                  operator: "",
                  value: ""
                }
              ]
            }
          : kpi
      )
    );
  };

  const updateFilter = (kpiId, filterId, patch) => {
    setKpis((prev) =>
      prev.map((kpi) => {
        if (kpi.id !== kpiId) return kpi;
        const filters = kpi.filters.map((filter) =>
          filter.id === filterId ? { ...filter, ...patch(filter) } : filter
        );
        return { ...kpi, filters };
      })
    );
  };

  const removeFilter = (kpiId, filterId) => {
    setKpis((prev) =>
      prev.map((kpi) =>
        kpi.id === kpiId
          ? { ...kpi, filters: kpi.filters.filter((filter) => filter.id !== filterId) }
          : kpi
      )
    );
  };

  return (
    <div className="analytics-layout container-fluid">
      <section className="analytics-hero">
        <div className="analytics-hero__text">
          <h2 className="h4 mb-2">Dynamic Analytics</h2>
          <p className="text-muted mb-0">
            Build KPI dashboards on the fly. Every calculation respects the global filters you set on the main toolbar.
          </p>
          <div className="analytics-hero__meta">
            <span>
              Active dataset
              <strong>{datasetSize.toLocaleString("en-US")}</strong>
            </span>
            <span>
              Distinct makes
              <strong>{summary.distinctMakes.toLocaleString("en-US")}</strong>
            </span>
            <span>
              New this week
              <strong>{summary.recentListings.toLocaleString("en-US")}</strong>
            </span>
          </div>
        </div>
        <div className="analytics-summary">
          <div className="analytics-summary__card">
            <span className="analytics-summary__label">Average price</span>
            <span className="analytics-summary__value">{fmtPrice(Math.round(summary.averagePrice))}</span>
          </div>
          <div className="analytics-summary__card">
            <span className="analytics-summary__label">Median price</span>
            <span className="analytics-summary__value">{fmtPrice(Math.round(summary.medianPrice))}</span>
          </div>
          <div className="analytics-summary__card">
            <span className="analytics-summary__label">Avg. market discount</span>
            <span className="analytics-summary__value">{summary.averageDiscount.toFixed(1)}%</span>
          </div>
        </div>
      </section>

      <section className="analytics-insights row g-3">
        <div className="col-12 col-lg-6">
          <div className="analytics-insights__card h-100">
            <header>
              <h3 className="h6 mb-1">Top performing makes</h3>
              <p className="text-muted extra-small mb-0">
                Sorted by number of active listings with average price and discount snapshot.
              </p>
            </header>
            <div className="table-responsive mt-3">
              <table className="table table-sm align-middle mb-0" aria-label="Top performing makes">
                <thead>
                  <tr>
                    <th scope="col">Make</th>
                    <th scope="col" className="text-end">Listings</th>
                    <th scope="col" className="text-end">Avg price</th>
                    <th scope="col" className="text-end">Avg discount</th>
                  </tr>
                </thead>
                <tbody>
                  {topMakes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        Not enough data to surface insights yet.
                      </td>
                    </tr>
                  ) : (
                    topMakes.map((entry) => (
                      <tr key={entry.make}>
                        <th scope="row">{entry.make}</th>
                        <td className="text-end">{entry.count.toLocaleString("en-US")}</td>
                        <td className="text-end">{fmtPrice(Math.round(entry.averagePrice))}</td>
                        <td className="text-end">
                          {entry.averageDiscount ? `${entry.averageDiscount.toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="col-12 col-lg-6">
          <div className="analytics-insights__card h-100">
            <header>
              <h3 className="h6 mb-1">Where demand is concentrated</h3>
              <p className="text-muted extra-small mb-0">
                Cities contributing the largest share of active listings right now.
              </p>
            </header>
            <div className="table-responsive mt-3">
              <table className="table table-sm align-middle mb-0" aria-label="Where demand is concentrated">
                <thead>
                  <tr>
                    <th scope="col">City</th>
                    <th scope="col" className="text-end">Listings</th>
                    <th scope="col" className="text-end">Share</th>
                    <th scope="col" className="text-end">Avg price</th>
                  </tr>
                </thead>
                <tbody>
                  {topCities.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-muted py-4">
                        Not enough data to surface insights yet.
                      </td>
                    </tr>
                  ) : (
                    topCities.map((entry) => (
                      <tr key={entry.city}>
                        <th scope="row">{entry.city}</th>
                        <td className="text-end">{entry.count.toLocaleString("en-US")}</td>
                        <td className="text-end">{entry.share.toFixed(1)}%</td>
                        <td className="text-end">{fmtPrice(Math.round(entry.averagePrice))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="analytics-kpis">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-lg-between gap-2 mb-3">
          <div>
            <h3 className="h5 mb-1">Custom KPI builder</h3>
            <p className="text-muted mb-0">Mix and match aggregations with flexible filters for on-the-fly analysis.</p>
          </div>
          <div>
            <button type="button" className="btn btn-primary" onClick={addKpi}>
              + Add KPI
            </button>
          </div>
        </div>

        <div className="row g-3">
          {kpis.map((kpi, index) => {
            const aggregator = AGGREGATORS.find((agg) => agg.value === kpi.aggregator) || AGGREGATORS[0];
            const needsField = aggregator.needsField;
            const metricMeta = needsField ? fieldMetaByValue[kpi.field] : null;
            const compatibleFields = needsField ? compatibleMetricFields(aggregator.value) : [];
          const result = kpiResults.find((r) => r.id === kpi.id)?.result ?? { formatted: "—", matches: 0 };
          const matchesText = Number.isFinite(result.matches)
            ? result.matches.toLocaleString("en-US")
            : "0";
          const detailText = needsField && metricMeta
            ? `${aggregator.label} of ${metricMeta.label}`
            : `${aggregator.label} of listings`;

          return (
            <div className="col-12 col-lg-6" key={kpi.id}>
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex flex-column gap-3">
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div className="flex-grow-1">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={kpi.name}
                        onChange={(e) => updateKpi(kpi.id, () => ({ name: e.target.value }))}
                        placeholder="Name your KPI"
                        aria-label="KPI name"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => removeKpi(kpi.id)}
                      disabled={kpis.length === 1 && index === 0}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="d-flex flex-column flex-md-row gap-2">
                    <div className="flex-grow-1">
                      <label className="form-label form-label-sm mb-1">Aggregator</label>
                      <select
                        className="form-select form-select-sm"
                        value={kpi.aggregator}
                        onChange={(e) => {
                          const nextAgg = e.target.value;
                          const needs = aggregatorNeedsField(nextAgg);
                          updateKpi(kpi.id, (current) => {
                            let nextField = current.field;
                            if (needs) {
                              const allowed = compatibleMetricFields(nextAgg);
                              if (!allowed.find((field) => field.value === nextField)) {
                                nextField = allowed.length ? allowed[0].value : null;
                              }
                            } else {
                              nextField = null;
                            }
                            return { aggregator: nextAgg, field: nextField };
                          });
                        }}
                        aria-label="Select aggregator"
                      >
                        {AGGREGATORS.map((option) => (
                          <option
                            key={option.value}
                            value={option.value}
                            disabled={option.needsField && !compatibleMetricFields(option.value).length}
                          >
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {needsField && (
                      <div className="flex-grow-1">
                        <label className="form-label form-label-sm mb-1">Metric</label>
                        <select
                          className="form-select form-select-sm"
                          value={kpi.field ?? ""}
                          onChange={(e) => {
                            const nextField = e.target.value || null;
                            updateKpi(kpi.id, (current) => {
                              if (!nextField) return { field: null };
                              const meta = fieldMetaByValue[nextField];
                              const allowedAgg = meta?.aggregators || [];
                              let nextAgg = current.aggregator;
                              if (!allowedAgg.includes(nextAgg)) {
                                nextAgg = allowedAgg.length ? allowedAgg[0] : "count";
                              }
                              return { field: nextField, aggregator: nextAgg };
                            });
                          }}
                          aria-label="Select metric field"
                        >
                          {compatibleFields.map((field) => (
                            <option key={field.value} value={field.value}>
                              {field.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="bg-light rounded p-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <h3 className="h6 mb-0">Filters</h3>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => addFilter(kpi.id)}
                      >
                        + Add filter
                      </button>
                    </div>

                    {kpi.filters.length === 0 ? (
                      <p className="text-muted small mb-0">No filters applied. This KPI uses the full filtered dataset.</p>
                    ) : (
                      <div className="d-flex flex-column gap-2">
                        {kpi.filters.map((filter) => {
                          const meta = fieldMetaByValue[filter.field] || {};
                          const isNumber = meta.type === "number";
                          const operators = isNumber ? NUMBER_OPERATORS : STRING_OPERATORS;
                          const valueOptions = suggestions[filter.field] || [];
                          const fieldId = `${filter.id}-field`;
                          const operatorId = `${filter.id}-operator`;
                          const valueId = `${filter.id}-value`;

                          return (
                            <div className="border rounded p-2" key={filter.id}>
                              <div className="row g-2 align-items-end">
                                <div className="col-12 col-md-4">
                                  <label className="form-label form-label-sm mb-1" htmlFor={fieldId}>Field</label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={filter.field}
                                    onChange={(e) => {
                                      const nextField = e.target.value;
                                      const nextMeta = fieldMetaByValue[nextField] || { type: "string" };
                                      updateFilter(kpi.id, filter.id, () => ({
                                        field: nextField,
                                        operator: defaultOperatorForType(nextMeta.type),
                                        value: ""
                                      }));
                                    }}
                                    aria-label="Filter field"
                                    id={fieldId}
                                  >
                                    <option value="">Select field…</option>
                                    {FILTER_FIELDS.map((field) => (
                                      <option key={field.value} value={field.value}>
                                        {field.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="col-12 col-md-3">
                                  <label className="form-label form-label-sm mb-1" htmlFor={operatorId}>Operator</label>
                                  <select
                                    className="form-select form-select-sm"
                                    value={filter.operator}
                                    onChange={(e) => {
                                      const nextOperator = e.target.value;
                                      updateFilter(kpi.id, filter.id, () => ({ operator: nextOperator }));
                                    }}
                                    aria-label="Filter operator"
                                    disabled={!filter.field}
                                    id={operatorId}
                                  >
                                    <option value="">Select…</option>
                                    {operators.map((op) => (
                                      <option key={op.value} value={op.value}>
                                        {op.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="col-12 col-md-4">
                                  <label className="form-label form-label-sm mb-1" htmlFor={valueId}>Value</label>
                                  {isNumber ? (
                                    <input
                                      type="number"
                                      className="form-control form-control-sm"
                                      value={filter.value}
                                      onChange={(e) => updateFilter(kpi.id, filter.id, () => ({ value: e.target.value }))}
                                      aria-label="Numeric filter value"
                                      disabled={!filter.operator}
                                      id={valueId}
                                    />
                                  ) : (
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      value={filter.value}
                                      onChange={(e) => updateFilter(kpi.id, filter.id, () => ({ value: e.target.value }))}
                                      list={valueOptions.length ? `${filter.id}-options` : undefined}
                                      aria-label="Filter value"
                                      disabled={!filter.operator}
                                      id={valueId}
                                    />
                                  )}
                                  {!isNumber && valueOptions.length ? (
                                    <datalist id={`${filter.id}-options`}>
                                      {valueOptions.map((val) => (
                                        <option key={val} value={val} />
                                      ))}
                                    </datalist>
                                  ) : null}
                                </div>

                                <div className="col-12 col-md-1 d-flex justify-content-md-center">
                                  <button
                                    type="button"
                                    className="btn btn-outline-secondary btn-sm w-100"
                                    onClick={() => removeFilter(kpi.id, filter.id)}
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-muted small mb-1">Result</div>
                    <div className="display-6 text-primary">{result.formatted}</div>
                    <div className="text-muted small">{detailText}</div>
                    <div className="text-muted small">Matches {matchesText} listings</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      </section>
    </div>
  );
};

export default Analytics;
