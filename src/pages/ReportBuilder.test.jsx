import React from "react";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, beforeEach, describe, it, expect } from "vitest";
import ReportBuilder from "./ReportBuilder.jsx";
import { jsPDF } from "jspdf";

vi.mock("jspdf", () => {
  const factory = vi.fn(() => ({
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFont: vi.fn(),
    setFontSize: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    internal: {
      pageSize: {
        getWidth: vi.fn(() => 595.28),
        getHeight: vi.fn(() => 842)
      }
    },
    save: vi.fn()
  }));
  return { jsPDF: factory, default: factory };
});

const buildRow = ({
  id,
  make,
  model,
  price,
  city,
  body,
  km,
  discount
}) => ({
  uid: `${make}-${model}-${id}`,
  details_make: make,
  brand: make,
  details_model: model,
  model,
  details_year: 2023,
  price,
  city_inferred: city,
  details_body_type: body,
  details_kilometers: km,
  market_discount_pct: discount
});

const sampleData = [
  buildRow({ id: 1, make: "Alpha", model: "A1", price: 52000, city: "Dubai", body: "SUV", km: 26000, discount: 6 }),
  buildRow({ id: 2, make: "Alpha", model: "A2", price: 54000, city: "Dubai", body: "Sedan", km: 28000, discount: 7 }),
  buildRow({ id: 3, make: "Beta", model: "B1", price: 45000, city: "Abu Dhabi", body: "SUV", km: 31000, discount: 4 }),
  buildRow({ id: 4, make: "Beta", model: "B2", price: 47000, city: "Abu Dhabi", body: "SUV", km: 33000, discount: 3 }),
  buildRow({ id: 5, make: "Gamma", model: "G1", price: 61000, city: "Dubai", body: "Coupe", km: 18000, discount: 2 })
];

beforeEach(() => {
  jsPDF.mockClear();
});

describe("ReportBuilder", () => {
  it("renders report preview with snapshot metrics", () => {
    render(<ReportBuilder data={sampleData} />);

    expect(screen.getByText(/Comprehensive Market Intelligence Report/i)).toBeInTheDocument();
    const statValue = document.querySelector(".report-preview__stat-value");
    expect(statValue).not.toBeNull();
    expect(statValue.textContent).toBe(String(sampleData.length));
    const metricsSection = document.querySelector(".report-preview__metrics");
    expect(metricsSection).not.toBeNull();
    expect(within(metricsSection).getByText(/Average price/i)).toBeInTheDocument();
    expect(within(metricsSection).getByText(/Market discount/i)).toBeInTheDocument();
  });

  it("filters summary when focus city changes", async () => {
    const user = userEvent.setup();
    render(<ReportBuilder data={sampleData} />);

    const citySelect = screen.getByLabelText(/Focus city/i);
    await user.selectOptions(citySelect, "Abu Dhabi");

    await waitFor(() => {
      const valueEl = document.querySelector(".report-preview__stat-value");
      expect(valueEl).not.toBeNull();
      expect(valueEl.textContent).toBe("2");
    });

    const hero = document.querySelector(".report-preview__hero");
    expect(hero).not.toBeNull();
    expect(within(hero).getByText(/Abu Dhabi/)).toBeInTheDocument();
  });

  it("downloads a PDF when requested", async () => {
    const user = userEvent.setup();
    render(<ReportBuilder data={sampleData} />);

    const downloadButton = screen.getByRole("button", { name: /download pdf report/i });
    await user.click(downloadButton);

    expect(jsPDF).toHaveBeenCalled();
    const instance = jsPDF.mock.results.at(-1).value;
    expect(instance.save).toHaveBeenCalled();
  });
});
