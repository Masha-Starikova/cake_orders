import { describe, expect, it } from "vitest";
import { monthGrid, toIsoDate } from "@/lib/dates";
import { normalizeDate } from "@/lib/server/blocked-dates";

describe("monthGrid", () => {
  it("сентябрь 2026 начинается со вторника и занимает 5 недель", () => {
    const grid = monthGrid(2026, 8);
    expect(grid.length % 7).toBe(0);
    expect(grid[0]).toBeNull(); // Пн пустой
    expect(grid[1] && toIsoDate(grid[1])).toBe("2026-09-01");
    expect(grid.filter(Boolean)).toHaveLength(30);
  });
});

describe("normalizeDate", () => {
  it("принимает ISO и русский формат из Google", () => {
    expect(normalizeDate("2026-09-14")).toBe("2026-09-14");
    expect(normalizeDate("14.09.2026")).toBe("2026-09-14");
    expect(normalizeDate("14/9/2026")).toBe("2026-09-14");
    expect(normalizeDate("вчера")).toBeNull();
  });
});
