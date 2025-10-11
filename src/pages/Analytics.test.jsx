import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Analytics from "./Analytics.jsx";

const buildSampleData = () => {
  const now = Date.now();
  return [
    {
      uid: "1",
      details_make: "Tesla",
      brand: "Tesla",
      price: 220000,
      market_discount_pct: 10,
      created_at_epoch_ms: now,
      city_inferred: "Dubai"
    },
    {
      uid: "2",
      details_make: "Tesla",
      brand: "Tesla",
      price: 210000,
      market_discount_pct: 8,
      created_at_epoch_ms: now - 1000,
      city_inferred: "Dubai"
    },
    {
      uid: "3",
      details_make: "Tesla",
      brand: "Tesla",
      price: 205000,
      market_discount_pct: 6,
      created_at_epoch_ms: now - 2000,
      city_inferred: "Dubai"
    },
    {
      uid: "4",
      details_make: "Nissan",
      brand: "Nissan",
      price: 80000,
      market_discount_pct: 4,
      created_at_epoch_ms: now,
      city_inferred: "Abu Dhabi"
    },
    {
      uid: "5",
      details_make: "Nissan",
      brand: "Nissan",
      price: 78000,
      market_discount_pct: 3,
      created_at_epoch_ms: now - 500,
      city_inferred: "Abu Dhabi"
    },
    {
      uid: "6",
      details_make: "Nissan",
      brand: "Nissan",
      price: 76000,
      market_discount_pct: 2,
      created_at_epoch_ms: now - 750,
      city_inferred: "Abu Dhabi"
    }
  ];
};

describe("Analytics page", () => {
  it("renders summary metrics and insights", () => {
    render(<Analytics data={buildSampleData()} />);

    const averageCard = screen.getByText(/^Average price$/i).closest(".analytics-summary__card");
    const medianCard = screen.getByText(/^Median price$/i).closest(".analytics-summary__card");
    const discountCard = screen.getByText(/^Avg\. market discount$/i).closest(".analytics-summary__card");

    expect(averageCard).not.toBeNull();
    expect(medianCard).not.toBeNull();
    expect(discountCard).not.toBeNull();

    expect(within(averageCard).getByText("AED 144,833")).toBeInTheDocument();
    expect(within(medianCard).getByText("AED 205,000")).toBeInTheDocument();
    expect(within(discountCard).getByText("5.5%")).toBeInTheDocument();

    const makesTable = screen.getByRole("table", { name: /top performing makes/i });
    const makesBody = within(makesTable).getAllByRole("row");
    expect(makesBody).toHaveLength(3); // header + 2 rows
    expect(within(makesBody[1]).getByRole("rowheader", { name: "Tesla" })).toBeInTheDocument();
    expect(within(makesBody[2]).getByRole("rowheader", { name: "Nissan" })).toBeInTheDocument();

    const citiesTable = screen.getByRole("table", { name: /where demand is concentrated/i });
    expect(within(citiesTable).getByRole("rowheader", { name: "Dubai" })).toBeInTheDocument();
    expect(within(citiesTable).getByRole("rowheader", { name: "Abu Dhabi" })).toBeInTheDocument();
  });

  it("allows adding filters to widgets", async () => {
    const user = userEvent.setup();
    render(<Analytics data={buildSampleData()} />);

    const widgetCard = screen.getByPlaceholderText(/name your insight/i).closest(".card");
    expect(widgetCard).not.toBeNull();

    const addFilterButton = within(widgetCard).getByRole("button", { name: /\+ add filter/i });
    await user.click(addFilterButton);

    const fieldSelect = within(widgetCard).getByLabelText("Field");
    await user.selectOptions(fieldSelect, "city_inferred");

    const valueInput = within(widgetCard).getByLabelText("Value");
    await user.type(valueInput, "Dubai");

    const matches = await within(widgetCard).findByText(/Matches 3 listings/i);
    expect(matches).toBeInTheDocument();
  });

  it("supports summary table widgets", async () => {
    const user = userEvent.setup();
    render(<Analytics data={buildSampleData()} />);

    const widgetCard = screen.getByPlaceholderText(/name your insight/i).closest(".card");
    expect(widgetCard).not.toBeNull();

    const typeSelect = within(widgetCard).getByLabelText(/select widget type/i);
    await user.selectOptions(typeSelect, "table");

    const summaryTable = await within(widgetCard).findByRole("table", { name: /summary by/i });
    expect(within(summaryTable).getByRole("rowheader", { name: "Tesla" })).toBeInTheDocument();
    expect(within(summaryTable).getByRole("rowheader", { name: "Nissan" })).toBeInTheDocument();
  });

  it("renders chart previews when configured", async () => {
    const user = userEvent.setup();
    render(<Analytics data={buildSampleData()} />);

    const widgetCard = screen.getByPlaceholderText(/name your insight/i).closest(".card");
    expect(widgetCard).not.toBeNull();

    const typeSelect = within(widgetCard).getByLabelText(/select widget type/i);
    await user.selectOptions(typeSelect, "chart");

    expect(within(widgetCard).getByText(/Top \d+ groups/i)).toBeInTheDocument();
  });
});
