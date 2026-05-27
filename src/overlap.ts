import type { RiskLevel, FileStatus } from "./types.js";

export const PROXIMITY_WINDOW = 5;

export const RISK_ORDER: Record<RiskLevel, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const HIGH_OVERLAP_THRESHOLD = 0.4;
const HIGH_OVERLAP_WITH_LARGE_MAIN_THRESHOLD = 0.2;
const MEDIUM_OVERLAP_THRESHOLD = 0.15;

const LARGE_MAIN_CHANGE = 20;
const SWEEPING_MAIN_CHANGE = 50;

export interface OverlapResult {
  overlapLines: number[];
  overlapScore: number;
}

export function computeOverlap(
  prLines: number[],
  mainLines: number[],
): OverlapResult {
  if (prLines.length === 0 || mainLines.length === 0) {
    return { overlapLines: [], overlapScore: 0 };
  }

  const mainSet = new Set(mainLines);
  const overlapping = new Set<number>();

  for (const prLine of prLines) {
    if (mainSet.has(prLine)) {
      overlapping.add(prLine);
      continue;
    }

    for (let delta = 1; delta <= PROXIMITY_WINDOW; delta++) {
      if (mainSet.has(prLine - delta) || mainSet.has(prLine + delta)) {
        overlapping.add(prLine);
        break;
      }
    }
  }

  const overlapLines = [...overlapping].sort((a, b) => a - b);
  const overlapScore = Math.min(overlapLines.length / prLines.length, 1.0);

  return { overlapLines, overlapScore };
}

export interface RiskInput {
  overlapScore: number;
  prChangeSize: number;
  mainChangeSize: number;
  prStatus: FileStatus;
  mainStatus: FileStatus;
}

export function assessRisk({
  overlapScore,
  mainChangeSize,
  prStatus,
  mainStatus,
}: RiskInput): RiskLevel {
  if (prStatus === "removed" || mainStatus === "removed") return "high";
  if (prStatus === "renamed" || mainStatus === "renamed") return "high";

  if (overlapScore > HIGH_OVERLAP_THRESHOLD) return "high";

  if (
    overlapScore > HIGH_OVERLAP_WITH_LARGE_MAIN_THRESHOLD &&
    mainChangeSize > LARGE_MAIN_CHANGE
  )
    return "high";

  if (
    overlapScore > MEDIUM_OVERLAP_THRESHOLD ||
    mainChangeSize > SWEEPING_MAIN_CHANGE
  )
    return "medium";

  return "low";
}
