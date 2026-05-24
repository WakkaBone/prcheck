import { describe, it, expect } from "vitest";
import { computeOverlap, assessRisk } from "../src/analyzer.js";

describe("computeOverlap", () => {
  it("returns zero score when PR lines are empty", () => {
    const { overlapLines, overlapScore } = computeOverlap([], [1, 2, 3]);
    expect(overlapScore).toBe(0);
    expect(overlapLines).toEqual([]);
  });

  it("returns zero score when main lines are empty", () => {
    const { overlapLines, overlapScore } = computeOverlap([1, 2, 3], []);
    expect(overlapScore).toBe(0);
    expect(overlapLines).toEqual([]);
  });

  it("returns zero when there is no overlap or proximity", () => {
    const { overlapScore } = computeOverlap([1, 2, 3], [20, 21, 22]);
    expect(overlapScore).toBe(0);
  });

  it("returns score of 1 on exact full overlap", () => {
    const { overlapScore, overlapLines } = computeOverlap([5, 6, 7], [5, 6, 7]);
    expect(overlapScore).toBe(1);
    expect(overlapLines).toEqual([5, 6, 7]);
  });

  it("returns partial score on partial exact overlap", () => {
    const { overlapScore } = computeOverlap([1, 2, 50, 51], [50, 51, 100, 101]);
    expect(overlapScore).toBe(0.5);
  });

  it("detects proximity overlap within window", () => {
    const { overlapLines, overlapScore } = computeOverlap([10], [13]);
    expect(overlapScore).toBeGreaterThan(0);
    expect(overlapLines).toContain(10);
  });

  it("does not flag lines outside the proximity window", () => {
    const { overlapScore } = computeOverlap([10], [20]);
    expect(overlapScore).toBe(0);
  });

  it("returns overlap lines sorted ascending", () => {
    const { overlapLines } = computeOverlap([9, 1, 5], [1, 5, 9]);
    expect(overlapLines).toEqual([1, 5, 9]);
  });

  it("caps score at 1.0", () => {
    const { overlapScore } = computeOverlap([1, 2], [1, 2, 3, 4, 5]);
    expect(overlapScore).toBeLessThanOrEqual(1.0);
  });
});

describe("assessRisk", () => {
  const base = {
    overlapScore: 0,
    prChangeSize: 5,
    mainChangeSize: 5,
    prStatus: "modified" as const,
    mainStatus: "modified" as const,
  };

  it("is always high when PR file was removed", () => {
    expect(assessRisk({ ...base, prStatus: "removed" })).toBe("high");
  });

  it("is always high when main file was removed", () => {
    expect(assessRisk({ ...base, mainStatus: "removed" })).toBe("high");
  });

  it("is always high when PR file was renamed", () => {
    expect(assessRisk({ ...base, prStatus: "renamed" })).toBe("high");
  });

  it("is always high when main file was renamed", () => {
    expect(assessRisk({ ...base, mainStatus: "renamed" })).toBe("high");
  });

  it("is high when overlap score exceeds 0.4", () => {
    expect(assessRisk({ ...base, overlapScore: 0.5 })).toBe("high");
  });

  it("is high when moderate overlap and large main change", () => {
    expect(
      assessRisk({ ...base, overlapScore: 0.25, mainChangeSize: 25 }),
    ).toBe("high");
  });

  it("is medium when overlap is between 0.15 and 0.4", () => {
    expect(assessRisk({ ...base, overlapScore: 0.2 })).toBe("medium");
  });

  it("is medium when main made sweeping changes nearby", () => {
    expect(assessRisk({ ...base, overlapScore: 0, mainChangeSize: 60 })).toBe(
      "medium",
    );
  });

  it("is low when overlap is minimal and main changes are small", () => {
    expect(assessRisk({ ...base, overlapScore: 0.05, mainChangeSize: 3 })).toBe(
      "low",
    );
  });

  it("is low when both branches have zero overlap", () => {
    expect(assessRisk({ ...base, overlapScore: 0 })).toBe("low");
  });
});
