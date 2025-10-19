import React from "react";
import { render, screen, within } from "@testing-library/react";
import Admin from "./Admin.jsx";

describe("Admin page", () => {
  const sampleSources = [
    {
      key: "primary",
      label: "Primary feed",
      listingCount: 120,
      rawCount: 130,
      averagePrice: 150000,
      effectiveSample: 110,
      removedOutliers: 5,
      freshnessLabel: "3 hr ago",
      lastUpdatedIso: "2024-02-20T10:00:00.000Z",
      coverageDays: 14,
      oldestIso: "2024-02-06T10:00:00.000Z",
      urls: ["https://example.com/primary.json"]
    }
  ];

  const sampleData = Array.from({ length: 120 }, (_, idx) => ({
    id: idx,
    source: "primary"
  }));

  it("renders summary cards and table rows", () => {
    render(<Admin data={sampleData} sources={sampleSources} />);

    const listingsCard = screen.getByText(/active listings/i).closest(".card-body");
    expect(listingsCard).not.toBeNull();
    expect(within(listingsCard).getByText("120")).toBeInTheDocument();

    const table = screen.getByRole("table", { name: /data source overview/i });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(2); // header + 1 data row
    expect(within(rows[1]).getByRole("rowheader", { name: /primary feed/i })).toBeInTheDocument();
    expect(within(rows[1]).getByText(/3 hr ago/)).toBeInTheDocument();
    expect(within(rows[1]).getByText(/AED 150,000/)).toBeInTheDocument();
  });

  it("shows placeholder when no sources provided", () => {
    render(<Admin data={[]} sources={[]} />);
    expect(screen.getByText(/no source metadata available/i)).toBeInTheDocument();
  });
});
