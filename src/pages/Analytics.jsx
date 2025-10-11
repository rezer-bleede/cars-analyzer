import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { fmtPrice } from "../utils";

const AGGREGATORS = [
  { value: "count", label: "Count", needsField: false },
  { value: "avg", label: "Average", needsField: true },
  { value: "sum", label: "Sum", needsField: true },
  { value: "min", label: "Minimum", needsField: true },
  { value: "max", label: "Maximum", needsField: true }
];

const WIDGET_TYPES = [
  { value: "metric", label: "Metric card" },
  { value: "table", label: "Summary table" },
  { value: "chart", label: "Chart" }
];

const CHART_VARIANTS = [
  { value: "bar", label: "Bar" },
  { value: "pie", label: "Pie" }
];

const CHART_COLORS = [
  "#2563eb",
  "#0ea5e9",
  "#f97316",
  "#10b981",
  "#a855f7",
  "#facc15",
  "#f43f5e",
  "#22d3ee",
  "#8b5cf6"
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

const GROUP_FIELDS = FILTER_FIELDS.filter((field) => field.type === "string" || field.value === "details_year");

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

const defaultGroupField = GROUP_FIELDS[0]?.value || "";

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

const applyFilters = (rows, filters) => {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(filters) || !filters.length) {
    return rows;
  }

  return filters.reduce((accRows, filter) => {
    if (!filter.field) return accRows;
    const meta = fieldMetaByValue[filter.field] || { type: "string" };
    const operator = filter.operator || defaultOperatorForType(meta.type);
    const rawValue = filter.value;
    if (rawValue == null || rawValue === "") return accRows;

    if (meta.type === "number") {
      const compareValue = normalizeNumeric(rawValue);
      if (compareValue == null) return [];
      return accRows.filter((row) => {
        const n = normalizeNumeric(row[filter.field]);
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
      });
    }

    const compareValue = String(rawValue).toLowerCase();
    return accRows.filter((row) => {
      const text = String(row[filter.field] ?? "").toLowerCase();
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
};

const formatValue = (value, fieldMeta) => {
  if (value == null || Number.isNaN(value)) return "—";
  const meta = fieldMeta || { type: "number" };
  switch (meta.type) {
    case "currency":
      return fmtPrice(Math.round(value));
    case "percent":
      return `${Number(value).toFixed(1)}%`;
    case "count":
      return Number(value).toLocaleString("en-US");
    case "number":
    default: {
      const precision = Math.abs(value) >= 100 ? 0 : 2;
      return Number(value).toLocaleString("en-US", { maximumFractionDigits: precision });
    }
  }
};

const aggregateNumericValues = (values, aggregator) => {
  if (!Array.isArray(values) || !values.length) return null;
  switch (aggregator) {
    case "sum":
      return values.reduce((sum, v) => sum + v, 0);
    case "avg": {
      const sum = values.reduce((total, v) => total + v, 0);
      return sum / values.length;
    }
    case "min":
      return Math.min(...values);
    case "max":
      return Math.max(...values);
    default:
      return null;
  }
};

const computeMetricWidget = (widget, rows) => {
  const filteredRows = applyFilters(rows, widget.filters);
  const matches = filteredRows.length;
  const aggregator = widget.aggregator || "count";
  const needsField = aggregatorNeedsField(aggregator);

  if (!needsField) {
    return {
      type: "metric",
      aggregator,
      field: null,
      fieldMeta: { type: "count", label: "Listings" },
      value: matches,
      formatted: matches.toLocaleString("en-US"),
      matches
    };
  }

  if (!widget.field) {
    return {
      type: "metric",
      aggregator,
      field: null,
      fieldMeta: null,
      value: null,
      formatted: "—",
      matches,
      message: "Select a metric field",
      needsField: true
    };
  }

  const values = filteredRows
    .map((row) => normalizeNumeric(row[widget.field]))
    .filter((value) => value != null);

  const value = aggregateNumericValues(values, aggregator);

  if (value == null) {
    return {
      type: "metric",
      aggregator,
      field: widget.field,
      fieldMeta: fieldMetaByValue[widget.field] || { type: "number", label: widget.field },
      value: null,
      formatted: "—",
      matches,
      message: "No numeric values available",
      needsField: true
    };
  }

  const fieldMeta = fieldMetaByValue[widget.field] || { type: "number", label: widget.field };
  return {
    type: "metric",
    aggregator,
    field: widget.field,
    fieldMeta,
    value,
    formatted: formatValue(value, fieldMeta),
    matches,
    samples: values.length
  };
};

const sanitizeLimit = (limit) => {
  const numeric = Number(limit);
  if (!Number.isFinite(numeric)) return 8;
  return Math.min(20, Math.max(3, Math.round(numeric)));
};

const buildGroupedAggregation = (widget, rows) => {
  const filteredRows = applyFilters(rows, widget.filters);
  const matches = filteredRows.length;
  const aggregator = widget.aggregator || "count";
  const needsField = aggregatorNeedsField(aggregator);

  if (!widget.groupBy) {
    return { data: [], matches, aggregator, message: "Pick a grouping field to summarise by." };
  }

  if (needsField && !widget.field) {
    return {
      data: [],
      matches,
      aggregator,
      message: "Select a metric field for this aggregation.",
      needsField: true
    };
  }

  const limit = sanitizeLimit(widget.limit);
  const groupMeta = fieldMetaByValue[widget.groupBy] || { label: widget.groupBy, type: "string" };
  const fieldMeta = needsField
    ? fieldMetaByValue[widget.field] || { label: widget.field, type: "number" }
    : { label: "Listings", type: "count" };

  const buckets = new Map();
  filteredRows.forEach((row) => {
    const rawKey = row[widget.groupBy];
    const key = rawKey == null || rawKey === "" ? "Unknown" : String(rawKey);
    const bucket = buckets.get(key) || { key, label: key, rows: [] };
    bucket.rows.push(row);
    buckets.set(key, bucket);
  });

  const aggregated = Array.from(buckets.values())
    .map((bucket) => {
      const count = bucket.rows.length;
      if (aggregator === "count") {
        const value = count;
        return {
          key: bucket.key,
          label: bucket.label,
          value,
          formatted: formatValue(value, { type: "count" }),
          count,
          share: matches ? (count / Math.max(matches, 1)) * 100 : 0,
          samples: count
        };
      }

      const numericValues = bucket.rows
        .map((row) => normalizeNumeric(row[widget.field]))
        .filter((value) => value != null);

      const value = aggregateNumericValues(numericValues, aggregator);
      if (value == null) return null;

      return {
        key: bucket.key,
        label: bucket.label,
        value,
        formatted: formatValue(value, fieldMeta),
        count,
        share: matches ? (count / Math.max(matches, 1)) * 100 : 0,
        samples: numericValues.length
      };
    })
    .filter(Boolean);

  if (!aggregated.length) {
    const message = matches === 0 ? "No listings match the current filters." : "Not enough data to compute this view.";
    return { data: [], matches, aggregator, message, fieldMeta, groupMeta };
  }

  aggregated.sort((a, b) => {
    if (aggregator === "min") {
      return a.value - b.value;
    }
    return b.value - a.value;
  });

  return {
    data: aggregated.slice(0, limit),
    matches,
    aggregator,
    fieldMeta,
    groupMeta,
    limit
  };
};

const computeTableWidget = (widget, rows) => ({
  type: "table",
  ...buildGroupedAggregation(widget, rows)
});

const computeChartWidget = (widget, rows) => ({
  type: "chart",
  variant: widget.chartVariant || "bar",
  ...buildGroupedAggregation(widget, rows)
});

const computeWidget = (widget, rows) => {
  switch (widget.type) {
    case "table":
      return computeTableWidget(widget, rows);
    case "chart":
      return computeChartWidget(widget, rows);
    case "metric":
    default:
      return computeMetricWidget(widget, rows);
  }
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
  const [widgets, setWidgets] = useState(() => [
    {
      id: nextId("widget"),
      name: "Active listings",
      type: "metric",
      aggregator: "count",
      field: null,
      groupBy: defaultGroupField,
      chartVariant: "bar",
      limit: 8,
      filters: []
    }
  ]);

  const suggestions = useMemo(() => buildFilterOptions(data), [data]);

  const widgetResults = useMemo(
    () =>
      widgets.map((widget) => ({
        id: widget.id,
        result: computeWidget(widget, data)
      })),
    [widgets, data]
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

  const updateWidget = (id, updater) => {
    setWidgets((prev) =>
      prev.map((widget) => (widget.id === id ? { ...widget, ...updater(widget) } : widget))
    );
  };

  const addWidget = () => {
    setWidgets((prev) => [
      ...prev,
      {
        id: nextId("widget"),
        name: "New insight",
        type: "metric",
        aggregator: "count",
        field: null,
        groupBy: defaultGroupField,
        chartVariant: "bar",
        limit: 8,
        filters: []
      }
    ]);
  };

  const removeWidget = (id) => {
    setWidgets((prev) => (prev.length > 1 ? prev.filter((widget) => widget.id !== id) : prev));
  };

  const addFilter = (widgetId) => {
    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === widgetId
          ? {
              ...widget,
              filters: [
                ...widget.filters,
                {
                  id: nextId("filter"),
                  field: "",
                  operator: "",
                  value: ""
                }
              ]
            }
          : widget
      )
    );
  };

  const updateFilter = (widgetId, filterId, patch) => {
    setWidgets((prev) =>
      prev.map((widget) => {
        if (widget.id !== widgetId) return widget;
        const filters = widget.filters.map((filter) =>
          filter.id === filterId ? { ...filter, ...patch(filter) } : filter
        );
        return { ...widget, filters };
      })
    );
  };

  const removeFilter = (widgetId, filterId) => {
    setWidgets((prev) =>
      prev.map((widget) =>
        widget.id === widgetId
          ? { ...widget, filters: widget.filters.filter((filter) => filter.id !== filterId) }
          : widget
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
            <h3 className="h5 mb-1">Custom insight builder</h3>
            <p className="text-muted mb-0">Mix and match metrics, tables, and charts that update with your sidebar filters.</p>
          </div>
          <div>
            <button type="button" className="btn btn-primary" onClick={addWidget}>
              + Add widget
            </button>
          </div>
        </div>

        <div className="row g-3">
          {widgets.map((widget, index) => {
            const aggregator = AGGREGATORS.find((agg) => agg.value === widget.aggregator) || AGGREGATORS[0];
            const needsField = aggregatorNeedsField(widget.aggregator);
            const metricOptions = needsField ? compatibleMetricFields(widget.aggregator) : [];
            const widgetResult = widgetResults.find((entry) => entry.id === widget.id)?.result ?? { formatted: "—", matches: 0, data: [] };
            const fieldMeta = widget.field ? fieldMetaByValue[widget.field] : null;
            const groupMeta = widget.groupBy ? fieldMetaByValue[widget.groupBy] : null;
            const resultFieldMeta = widgetResult.fieldMeta || fieldMeta || { label: "Metric" };
            const matchesText = Number.isFinite(widgetResult.matches)
              ? widgetResult.matches.toLocaleString("en-US")
              : "0";
            const aggregatorLabel = aggregator.label;
            const groupLabel = groupMeta?.label || "Group";
            const detailText = widget.type === "metric"
              ? needsField && fieldMeta
                ? `${aggregatorLabel} of ${fieldMeta.label}`
                : `${aggregatorLabel} of listings`
              : needsField && fieldMeta
                ? `${aggregatorLabel} of ${fieldMeta.label} by ${groupLabel}`
                : `${aggregatorLabel} of listings by ${groupLabel}`;
            const previewData = Array.isArray(widgetResult.data) ? widgetResult.data : [];
            const limitValue = widget.limit ?? 8;
            const rotateLabels = previewData.length > 8;

            return (
              <div className="col-12 col-xl-6" key={widget.id}>
                <div className="card border-0 shadow-sm h-100 analytics-widget">
                  <div className="card-body d-flex flex-column gap-3">
                    <div className="d-flex flex-column flex-md-row gap-2 align-items-md-start justify-content-between">
                      <div className="flex-grow-1">
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={widget.name}
                          onChange={(e) => updateWidget(widget.id, () => ({ name: e.target.value }))}
                          placeholder="Name your insight"
                          aria-label="Widget name"
                        />
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <select
                          className="form-select form-select-sm"
                          value={widget.type}
                          onChange={(e) => {
                            const nextType = e.target.value;
                            updateWidget(widget.id, (current) => ({
                              type: nextType,
                              aggregator: "count",
                              field: null,
                              groupBy: current.groupBy || defaultGroupField,
                              chartVariant: nextType === "chart" ? current.chartVariant || "bar" : current.chartVariant || "bar",
                              limit: current.limit || 8
                            }));
                          }}
                          aria-label="Select widget type"
                        >
                          {WIDGET_TYPES.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => removeWidget(widget.id)}
                          disabled={widgets.length === 1 && index === 0}
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <div className="row g-2">
                      <div className="col-12 col-md-4">
                        <label className="form-label form-label-sm mb-1">Aggregator</label>
                        <select
                          className="form-select form-select-sm"
                          value={widget.aggregator}
                          onChange={(e) => {
                            const nextAgg = e.target.value;
                            const needs = aggregatorNeedsField(nextAgg);
                            updateWidget(widget.id, (current) => {
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
                        <div className="col-12 col-md-4">
                          <label className="form-label form-label-sm mb-1">Metric</label>
                          <select
                            className="form-select form-select-sm"
                            value={widget.field ?? ""}
                            onChange={(e) => {
                              const nextField = e.target.value || null;
                              updateWidget(widget.id, (current) => {
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
                            {metricOptions.map((field) => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {widget.type !== "metric" && (
                        <div className="col-12 col-md-4">
                          <label className="form-label form-label-sm mb-1">Group by</label>
                          <select
                            className="form-select form-select-sm"
                            value={widget.groupBy ?? ""}
                            onChange={(e) => updateWidget(widget.id, () => ({ groupBy: e.target.value }))}
                            aria-label="Select grouping field"
                          >
                            {GROUP_FIELDS.map((field) => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {widget.type !== "metric" && (
                        <div className="col-12 col-md-4 col-lg-3">
                          <label className="form-label form-label-sm mb-1">Top results</label>
                          <input
                            type="number"
                            className="form-control form-control-sm"
                            min="3"
                            max="20"
                            step="1"
                            value={limitValue}
                            onChange={(e) => updateWidget(widget.id, () => ({ limit: e.target.value }))}
                            aria-label="Limit number of rows"
                          />
                        </div>
                      )}

                      {widget.type === "chart" && (
                        <div className="col-12 col-md-4 col-lg-3">
                          <label className="form-label form-label-sm mb-1">Chart style</label>
                          <select
                            className="form-select form-select-sm"
                            value={widget.chartVariant ?? "bar"}
                            onChange={(e) => updateWidget(widget.id, () => ({ chartVariant: e.target.value }))}
                            aria-label="Select chart variant"
                          >
                            {CHART_VARIANTS.map((variant) => (
                              <option key={variant.value} value={variant.value}>
                                {variant.label}
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
                          onClick={() => addFilter(widget.id)}
                        >
                          + Add filter
                        </button>
                      </div>

                      {widget.filters.length === 0 ? (
                        <p className="text-muted small mb-0">No filters applied. This widget uses the globally filtered dataset.</p>
                      ) : (
                        <div className="d-flex flex-column gap-2">
                          {widget.filters.map((filter) => {
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
                                        updateFilter(widget.id, filter.id, () => ({
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
                                        updateFilter(widget.id, filter.id, () => ({ operator: nextOperator }));
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
                                        onChange={(e) => updateFilter(widget.id, filter.id, () => ({ value: e.target.value }))}
                                        aria-label="Numeric filter value"
                                        disabled={!filter.operator}
                                        id={valueId}
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        className="form-control form-control-sm"
                                        value={filter.value}
                                        onChange={(e) => updateFilter(widget.id, filter.id, () => ({ value: e.target.value }))}
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
                                      onClick={() => removeFilter(widget.id, filter.id)}
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

                    {widget.type === "metric" ? (
                      <div>
                        <div className="text-muted small mb-1">Result</div>
                        <div className="display-6 text-primary">{widgetResult.formatted ?? "—"}</div>
                        <div className="text-muted small">{detailText}</div>
                        <div className="text-muted small">Matches {matchesText} listings</div>
                        {widgetResult.message && (
                          <div className="text-warning small mt-2">{widgetResult.message}</div>
                        )}
                      </div>
                    ) : widget.type === "table" ? (
                      <div className="d-flex flex-column gap-2">
                        <div className="text-muted small">Preview</div>
                        {widgetResult.message ? (
                          <p className="text-muted small mb-0">{widgetResult.message}</p>
                        ) : previewData.length === 0 ? (
                          <p className="text-muted small mb-0">Not enough data to render a table yet.</p>
                        ) : (
                          <div className="table-responsive">
                            <table className="table table-sm align-middle mb-0" aria-label={`Summary by ${groupLabel}`}>
                              <thead>
                                <tr>
                                  <th scope="col">{groupLabel}</th>
                                  <th scope="col" className="text-end">{resultFieldMeta.label}</th>
                                  <th scope="col" className="text-end">Share</th>
                                  <th scope="col" className="text-end">Listings</th>
                                </tr>
                              </thead>
                              <tbody>
                                {previewData.map((entry) => (
                                  <tr key={entry.key}>
                                    <th scope="row">{entry.label}</th>
                                    <td className="text-end">{entry.formatted}</td>
                                    <td className="text-end">{entry.share.toFixed(1)}%</td>
                                    <td className="text-end">{entry.count.toLocaleString("en-US")}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div className="text-muted extra-small">Top {previewData.length} rows · Matches {matchesText} listings</div>
                      </div>
                    ) : (
                      <div className="analytics-widget__chart">
                        <div className="text-muted small mb-2">Preview</div>
                        {widgetResult.message ? (
                          <p className="text-muted small mb-0">{widgetResult.message}</p>
                        ) : previewData.length === 0 ? (
                          <p className="text-muted small mb-0">Not enough data to draw this chart.</p>
                        ) : (
                          <ResponsiveContainer width="100%" height={260}>
                            {widget.chartVariant === "pie" ? (
                              <PieChart>
                                <Tooltip formatter={(value, name) => [formatValue(value, widgetResult.fieldMeta), name]} />
                                <Legend />
                                <Pie
                                  data={previewData}
                                  dataKey="value"
                                  nameKey="label"
                                  innerRadius={50}
                                  outerRadius={95}
                                  paddingAngle={3}
                                >
                                  {previewData.map((entry, idx) => (
                                    <Cell key={entry.key} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                                  ))}
                                </Pie>
                              </PieChart>
                            ) : (
                              <BarChart data={previewData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="label"
                                  interval={0}
                                  angle={rotateLabels ? -40 : 0}
                                  textAnchor={rotateLabels ? "end" : "middle"}
                                  height={rotateLabels ? 80 : 40}
                                  tick={{ fontSize: rotateLabels ? 11 : 12 }}
                                />
                                <YAxis />
                                <Tooltip formatter={(value, name) => [formatValue(value, widgetResult.fieldMeta), name]} />
                                <Bar dataKey="value" fill="#2563eb" radius={[6, 6, 0, 0]} />
                              </BarChart>
                            )}
                          </ResponsiveContainer>
                        )}
                        <div className="text-muted extra-small mt-2">Top {previewData.length} groups · Matches {matchesText} listings</div>
                      </div>
                    )}
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
