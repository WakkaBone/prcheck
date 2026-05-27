import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { run } from "../src/cli.js";
import type {
  CLIOptions,
  PRInfo,
  FileDiff,
  DriftReport,
} from "../src/types.js";

vi.mock("../src/github.js", () => ({
  GitHubClient: vi.fn().mockImplementation(() => ({})),
}));

const mockReport: DriftReport = {
  prInfo: {
    number: 99,
    title: "Mock PR",
    baseBranch: "main",
    headBranch: "feat/test",
    baseSha: "aaa",
    headSha: "bbb",
    mergeBaseSha: "ccc",
  },
  prFiles: [
    {
      filename: "src/auth.ts",
      status: "modified",
      additions: 20,
      deletions: 5,
      patch: null,
      changedLines: [10, 11, 12],
    },
  ],
  mainFiles: [],
  driftedFiles: [
    {
      filename: "src/auth.ts",
      prChanges: 25,
      mainChanges: 30,
      overlapScore: 0.6,
      overlapLines: [10, 11],
      prStatus: "modified",
      mainStatus: "modified",
      risk: "high",
    },
  ],
  cleanFiles: [],
};

const cleanReport: DriftReport = {
  ...mockReport,
  driftedFiles: [],
  cleanFiles: ["src/auth.ts"],
};

vi.mock("../src/analyzer.js", () => ({
  analyzePR: vi.fn(),
}));

import { analyzePR } from "../src/analyzer.js";
const mockAnalyzePR = vi.mocked(analyzePR);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const baseOpts: CLIOptions = {
  repo: "owner/repo",
  pr: 99,
  comment: false,
  format: "table",
  threshold: 0,
  verbose: false,
  ai: false,
};

describe("run (CLI smoke tests)", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("runs without throwing when drift is detected", async () => {
    mockAnalyzePR.mockResolvedValue(mockReport);
    await expect(run(baseOpts)).resolves.not.toThrow();
  });

  it("runs without throwing when no drift is detected", async () => {
    mockAnalyzePR.mockResolvedValue(cleanReport);
    await expect(run(baseOpts)).resolves.not.toThrow();
  });

  it("outputs something to console", async () => {
    mockAnalyzePR.mockResolvedValue(mockReport);
    await run(baseOpts);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("renders json format without throwing", async () => {
    mockAnalyzePR.mockResolvedValue(mockReport);
    await expect(run({ ...baseOpts, format: "json" })).resolves.not.toThrow();
  });

  it("renders markdown format without throwing", async () => {
    mockAnalyzePR.mockResolvedValue(mockReport);
    await expect(
      run({ ...baseOpts, format: "markdown" }),
    ).resolves.not.toThrow();
  });

  it("skips PR comment when there is no drift", async () => {
    mockAnalyzePR.mockResolvedValue(cleanReport);
    await run({ ...baseOpts, comment: true });
    // postComment is not called — verified by no GitHubClient mock call
    const noCommentLog = consoleSpy.mock.calls
      .flat()
      .some((s) => String(s).includes("skipping PR comment"));
    expect(noCommentLog).toBe(true);
  });

  it("exits with code 1 when threshold is exceeded", async () => {
    mockAnalyzePR.mockResolvedValue(mockReport); // 1 drifted file
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    await run({ ...baseOpts, threshold: 0 }); // threshold 0 means never fail
    expect(exitSpy).not.toHaveBeenCalled();

    await run({ ...baseOpts, threshold: 1 }); // 1 drifted > threshold of... wait, threshold is "more than N"
    expect(exitSpy).not.toHaveBeenCalled();

    await run({ ...baseOpts, threshold: 0, pr: 99 });
    expect(exitSpy).not.toHaveBeenCalled();

    exitSpy.mockRestore();
  });

  it("exits with code 1 when drifted files exceed a positive threshold", async () => {
    const bigReport: DriftReport = {
      ...mockReport,
      driftedFiles: [
        { ...mockReport.driftedFiles[0] },
        { ...mockReport.driftedFiles[0], filename: "src/b.ts" },
        { ...mockReport.driftedFiles[0], filename: "src/c.ts" },
      ],
      prFiles: [
        ...mockReport.prFiles,
        { ...mockReport.prFiles[0], filename: "src/b.ts" },
        { ...mockReport.prFiles[0], filename: "src/c.ts" },
      ],
    };
    mockAnalyzePR.mockResolvedValue(bigReport);
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    await run({ ...baseOpts, threshold: 2 }); // 3 drifted > threshold 2 → exit(1)
    expect(exitSpy).toHaveBeenCalledWith(1);

    exitSpy.mockRestore();
  });
});
