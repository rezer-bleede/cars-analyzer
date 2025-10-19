import { describe, expect, it } from "vitest";
import { computeTrimmedAverage, formatRelativeTime, toArray } from "./utils";

describe("computeTrimmedAverage", () => {
  it("excludes extreme outliers when computing the mean", () => {
    const values = [100000, 101000, 99000, 2500000];
    const result = computeTrimmedAverage(values);
    expect(result.average).toBe(100000);
    expect(result.count).toBe(3);
    expect(result.removed).toBe(1);
  });

  it("falls back to using all values when distribution is tight", () => {
    const values = [50000, 50500, 49500];
    const result = computeTrimmedAverage(values);
    expect(result.average).toBe(50000);
    expect(result.count).toBe(3);
    expect(result.removed).toBe(0);
  });
});

describe("formatRelativeTime", () => {
  it("creates a human readable delta", () => {
    const now = new Date("2024-02-20T00:00:00Z").getTime();
    const timestamp = new Date("2024-02-19T22:30:00Z").getTime();
    expect(formatRelativeTime(timestamp, now)).toBe("2 hr ago");
  });

  it("describes future timestamps", () => {
    const now = new Date("2024-02-20T00:00:00Z").getTime();
    const timestamp = new Date("2024-02-20T01:00:00Z").getTime();
    expect(formatRelativeTime(timestamp, now)).toBe("in 1 hr");
  });
});

describe("toArray", () => {
  it("finds nested arrays in payload objects", () => {
    const payload = { data: { results: [{ id: 1 }, { id: 2 }] } };
    expect(toArray(payload)).toHaveLength(2);
  });

  it("returns an empty array when nothing is found", () => {
    expect(toArray({ foo: "bar" })).toEqual([]);
  });
});
