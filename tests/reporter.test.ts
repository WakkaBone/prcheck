import { describe, it, expect } from "vitest";
import {
  render,
  formatLineRanges,
  riskEmoji,
  summaryAdvice,
} from "../src/reporter.js";
import type {
  DriftReport,
  DriftedFile,
  PRInfo,
  FileDiff,
} from "../src/types.js";

const prInfo: PRInfo = {
  number: 42,
  title: "Refactor auth middleware",
  baseBranch: "main",
  headBranch: "feat/auth",
  baseSha: "abc123",
  headSha: "def456",
  mergeBaseSha: "aaa000",
};

const mockFile: FileDiff = {
  filename: "src/auth.ts",
  status: "modified",
  additions: 20,
  deletions: 5,
  patch: null,
  changedLines: [10, 11, 12],
};

const highRiskDrift: DriftedFile = {
  filename: "src/auth.ts",
  prChanges: 25,
  mainChanges: 30,
  overlapScore: 0.6,
  overlapLines: [10, 11, 12],
  prStatus: "modified",
  mainStatus: "modified",
  risk: "high",
};

const lowRiskDrift: DriftedFile = {
  filename: "src/utils.ts",
  prChanges: 5,
  mainChanges: 3,
  overlapScore: 0.05,
  overlapLines: [],
  prStatus: "modified",
  mainStatus: "modified",
  risk: "low",
};

function makeReport(overrides: Partial<DriftReport> = {}): DriftReport {
  return {
    prInfo,
    prFiles: [mockFile],
    mainFiles: [mockFile],
    driftedFiles: [],
    cleanFiles: ["src/auth.ts"],
    ...overrides,
  };
}

describe("formatLineRanges", () => {
  it("returns empty string for empty array", () => {
    expect(formatLineRanges([])).toBe("");
  });

  it("formats a single line", () => {
    expect(formatLineRanges([5])).toBe("5");
  });

  it("formats a single contiguous range", () => {
    expect(formatLineRanges([1, 2, 3])).toBe("1-3");
  });

  it("formats multiple ranges", () => {
    expect(formatLineRanges([1, 2, 3, 7, 8])).toBe("1-3, 7-8");
  });

  it("formats non-contiguous single lines", () => {
    expect(formatLineRanges([1, 5, 9])).toBe("1, 5, 9");
  });

  it("handles mixed ranges and singles", () => {
    expect(formatLineRanges([1, 2, 5, 8, 9, 10])).toBe("1-2, 5, 8-10");
  });
});

describe("riskEmoji", () => {
  it("returns red for high", () => expect(riskEmoji("high")).toBe("🔴"));
  it("returns yellow for medium", () => expect(riskEmoji("medium")).toBe("🟡"));
  it("returns green for low", () => expect(riskEmoji("low")).toBe("🟢"));
});

describe("summaryAdvice", () => {
  it("returns no-drift message for empty array", () => {
    expect(summaryAdvice([])).toBe("No drift detected.");
  });

  it("returns high-risk advice when first file is high", () => {
    const advice = summaryAdvice([highRiskDrift]);
    expect(advice).toContain("High-risk");
    expect(advice).toContain("rebasing");
  });

  it("returns medium advice when highest risk is medium", () => {
    const medium: DriftedFile = { ...highRiskDrift, risk: "medium" };
    expect(summaryAdvice([medium])).toContain("Moderate");
  });

  it("returns low advice when highest risk is low", () => {
    expect(summaryAdvice([lowRiskDrift])).toContain("Low-risk");
  });
});

describe("render (table)", () => {
  it("shows clean message when no drift", () => {
    const out = render(makeReport(), { format: "table" });
    expect(out).toContain("No drift detected");
    expect(out).toContain("PR #42");
  });

  it("shows drift summary when files are drifted", () => {
    const out = render(
      makeReport({ driftedFiles: [highRiskDrift], cleanFiles: [] }),
      { format: "table" },
    );
    expect(out).toContain("Drift detected");
    expect(out).toContain("src/auth.ts");
    expect(out).toContain("60%");
    expect(out).toContain("high");
  });

  it("shows overlap lines in verbose mode", () => {
    const out = render(
      makeReport({ driftedFiles: [highRiskDrift], cleanFiles: [] }),
      { format: "table", verbose: true },
    );
    expect(out).toContain("overlapping lines");
    expect(out).toContain("10-12");
  });

  it("does not show overlap lines without verbose", () => {
    const out = render(
      makeReport({ driftedFiles: [highRiskDrift], cleanFiles: [] }),
      { format: "table", verbose: false },
    );
    expect(out).not.toContain("overlapping lines");
  });

  it("shows AI insight when present", () => {
    const withInsight: DriftedFile = {
      ...highRiskDrift,
      aiInsight: "Both branches modified the session handler.",
    };
    const out = render(
      makeReport({ driftedFiles: [withInsight], cleanFiles: [] }),
      { format: "table" },
    );
    expect(out).toContain("Both branches modified the session handler.");
  });
});

describe("render (markdown)", () => {
  it("shows clean message when no drift", () => {
    const out = render(makeReport(), { format: "markdown" });
    expect(out).toContain("No drift detected");
    expect(out).toContain("<!-- prcheck -->");
  });

  it("renders a markdown table with drifted files", () => {
    const out = render(
      makeReport({ driftedFiles: [highRiskDrift], cleanFiles: [] }),
      { format: "markdown" },
    );
    expect(out).toContain("| `src/auth.ts`");
    expect(out).toContain("🔴");
    expect(out).toContain("60%");
  });

  it("adds AI insight column when insights are present", () => {
    const withInsight: DriftedFile = {
      ...highRiskDrift,
      aiInsight: "Conflict in session logic.",
    };
    const out = render(
      makeReport({ driftedFiles: [withInsight], cleanFiles: [] }),
      { format: "markdown" },
    );
    expect(out).toContain("AI insight");
    expect(out).toContain("Conflict in session logic.");
  });

  it("omits AI column when no insights", () => {
    const out = render(
      makeReport({ driftedFiles: [highRiskDrift], cleanFiles: [] }),
      { format: "markdown" },
    );
    expect(out).not.toContain("AI insight");
  });
});

describe("render (json)", () => {
  it("produces valid JSON", () => {
    const out = render(makeReport(), { format: "json" });
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it("includes summary fields", () => {
    const parsed = JSON.parse(render(makeReport(), { format: "json" }));
    expect(parsed.summary.totalFiles).toBe(1);
    expect(parsed.summary.driftedFiles).toBe(0);
    expect(parsed.summary.highestRisk).toBe("none");
  });

  it("includes drifted file details", () => {
    const parsed = JSON.parse(
      render(makeReport({ driftedFiles: [highRiskDrift], cleanFiles: [] }), {
        format: "json",
      }),
    );
    expect(parsed.drifted).toHaveLength(1);
    expect(parsed.drifted[0].filename).toBe("src/auth.ts");
    expect(parsed.drifted[0].overlapScore).toBe(0.6);
    expect(parsed.drifted[0].risk).toBe("high");
  });

  it("includes aiInsight in json when present", () => {
    const withInsight: DriftedFile = {
      ...highRiskDrift,
      aiInsight: "Session conflict.",
    };
    const parsed = JSON.parse(
      render(makeReport({ driftedFiles: [withInsight], cleanFiles: [] }), {
        format: "json",
      }),
    );
    expect(parsed.drifted[0].aiInsight).toBe("Session conflict.");
  });

  it("omits aiInsight key when not present", () => {
    const parsed = JSON.parse(
      render(makeReport({ driftedFiles: [highRiskDrift], cleanFiles: [] }), {
        format: "json",
      }),
    );
    expect(parsed.drifted[0]).not.toHaveProperty("aiInsight");
  });
});
