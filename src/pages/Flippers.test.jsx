import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Flippers from "./Flippers.jsx";

const buildRow = () => ({
  uid: "abc",
  created_at_epoch_ms: Date.now(),
  details_make: "Toyota",
  brand: "Toyota",
  details_model: "Land Cruiser",
  model: "Land Cruiser",
  details_year: 2022,
  price: 320000,
  market_avg: 360000,
  market_diff: 40000,
  market_discount_pct: (40000 / 360000) * 100,
  location_full: "Dubai",
  details_seller_type: "Dealer",
  details_regional_specs: "GCC",
});

describe("Flippers page", () => {
  it("renders discount percent with inline market delta", () => {
    const dateWindow = { label: "last 7 days", cutoffMs: Date.now() - 7 * 24 * 60 * 60 * 1000 };
    render(
      <MemoryRouter>
        <Flippers data={[buildRow()]} dateWindow={dateWindow} />
      </MemoryRouter>
    );

    expect(screen.queryByText(/market discount/i)).not.toBeInTheDocument();

    const discountCell = screen.getByText(/11\.1%/i).closest("td");
    expect(discountCell).not.toBeNull();
    expect(within(discountCell).getByText(/AED 40,000/i)).toBeInTheDocument();
  });
});
