import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Charts from "./Charts.jsx";

const buildSampleRow = ({
  id,
  make,
  model,
  year,
  price,
  city = "Dubai"
}) => ({
  uid: `${make}-${model}-${year}-${id}`,
  id: `${make}-${model}-${year}-${id}`,
  details_make: make,
  brand: make,
  details_model: model,
  model,
  details_year: year,
  price,
  city_inferred: city
});

const buildSampleData = () => {
  const entries = [];
  const addSeries = (make, model, basePrice, depreciation) => {
    for (let i = 0; i < 5; i += 1) {
      const year = 2024 - i;
      const price = Math.round(basePrice - depreciation * i);
      entries.push(buildSampleRow({ id: i, make, model, year, price }));
    }
  };

  addSeries("Alpha", "A1", 42000, 4000);
  addSeries("Alpha", "A2", 46000, 5200);
  addSeries("Beta", "B1", 38000, 1200);
  addSeries("Beta", "B2", 36000, 800);
  addSeries("Gamma", "G1", 50000, 2500);
  addSeries("Gamma", "G2", 52000, 2600);

  return entries;
};

describe("Charts depreciation insights", () => {
  it("renders depreciation leaderboards", () => {
    render(<Charts data={buildSampleData()} />);

    expect(screen.getByText(/Top 5 most depreciating car brands/i)).toBeInTheDocument();
    expect(screen.getByText(/Top 5 least depreciating car brands/i)).toBeInTheDocument();
  });

  it("reveals model level insights when selecting brands", async () => {
    const user = userEvent.setup();
    render(<Charts data={buildSampleData()} />);

    const mostCard = screen.getByText(/Top 5 most depreciating car brands/i).closest(".card");
    const leastCard = screen.getByText(/Top 5 least depreciating car brands/i).closest(".card");

    expect(mostCard).not.toBeNull();
    expect(leastCard).not.toBeNull();

    const alphaButton = within(mostCard).getByRole("button", { name: /alpha/i });
    await user.click(alphaButton);

    expect(within(mostCard).getByText(/Most depreciating models/i)).toBeInTheDocument();
    expect(within(mostCard).getByText("A1")).toBeInTheDocument();
    expect(within(mostCard).getByText("A2")).toBeInTheDocument();

    const betaButton = within(leastCard).getByRole("button", { name: /beta/i });
    await user.click(betaButton);

    expect(within(leastCard).getByText(/Most resilient models/i)).toBeInTheDocument();
    expect(within(leastCard).getByText("B1")).toBeInTheDocument();
    expect(within(leastCard).getByText("B2")).toBeInTheDocument();
  });
});
