import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen, waitFor, within } from "@testing-library/react";
import App from "./App.jsx";

describe("App integration", () => {
  const fixedNow = new Date("2024-05-01T00:00:00Z").getTime();

  beforeEach(() => {
    vi.stubEnv("VITE_R2_JSON_URL", "[\"https://primary.test/feed.json\"]");
    vi.stubEnv("VITE_SECONDARY_JSON_URL", "[\"https://secondary.test/feed.json\"]");
    vi.spyOn(Date, "now").mockReturnValue(fixedNow);

    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      const primaryPayload = [
        {
          id: "primary-1",
          title_en: "Nissan Altima 2020",
          price: 98000,
          city_inferred: "Dubai",
          details_make: "Nissan",
          details_model: "Altima",
          details_body_type: "Sedan",
          details_year: 2020,
          created_at_iso: "2024-04-15T00:00:00Z",
          created_at_epoch_ms: new Date("2024-04-15T00:00:00Z").getTime(),
          source: "CSWITCH",
        }
      ];

      const secondaryPayload = `{"id":"secondary-1","detail_make":"honda","detail_model":"civic","detail_body_type":"body.coupe","detail_vehicle_model_date":2021,"detail_mileage_unit":"KMT","detail_mileage_value":12,"detail_offer_price":85000,"detail_name":"Honda Civic 2021","detail_item_url":"https://example.com/civic","created_at_iso":"2024-04-16T00:00:00Z","city":"dubai"}`;

      const body = url.includes("primary") ? JSON.stringify(primaryPayload) : `${secondaryPayload}\n`;
      return new Response(body, {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("loads configured feeds and surfaces source summaries", async () => {
    render(
      <MemoryRouter initialEntries={["/admin"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Data Sources Console/i })).toBeInTheDocument();
    });

    const primaryRowLabel = await screen.findByText("Primary feed");
    expect(primaryRowLabel).toBeInTheDocument();

    const table = screen.getByRole("table", { name: /Data source overview/i });
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(3); // header + two data rows

    const secondaryRowLabel = await screen.findByText("Secondary feed");
    expect(secondaryRowLabel).toBeInTheDocument();

    const secondaryRow = secondaryRowLabel.closest("tr");
    expect(secondaryRow).not.toBeNull();
    if (!secondaryRow) throw new Error("Secondary row not found");

    expect(within(secondaryRow).getByText(/Raw: 1/)).toBeInTheDocument();
    expect(within(secondaryRow).getByText(/ago/)).toBeInTheDocument();

    const primaryRow = primaryRowLabel.closest("tr");
    expect(primaryRow).not.toBeNull();
    if (!primaryRow) throw new Error("Primary row not found");

    expect(within(primaryRow).getByText("CSWITCH")).toBeInTheDocument();
    expect(screen.queryByRole("row", { name: /^CSWITCH/i })).toBeNull();
  });
});
