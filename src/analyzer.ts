import type {
  DriftedFile,
  DriftReport,
  RiskLevel,
  FileStatus,
} from "./types.js";
import type { GitHubClient } from "./github.js";

export async function analyzePR(
  client: GitHubClient,
  prNumber: number,
): Promise<DriftReport> {
  const prInfo = await client.getPRInfo(prNumber);
  const prFiles = await client.getPRFiles(prNumber);
  const mainFiles = await client.getMainBranchChanges(
    prInfo.baseBranch,
    prInfo.mergeBaseSha,
  );

  const mainByFile = new Map(mainFiles.map((f) => [f.filename, f]));

  const driftedFiles: DriftedFile[] = [];
  const cleanFiles: string[] = [];

  for (const prFile of prFiles) {
    if (prFile.status === "added") {
      cleanFiles.push(prFile.filename);
      continue;
    }

    const mainFile = mainByFile.get(prFile.filename);

    if (!mainFile) {
      cleanFiles.push(prFile.filename);
      continue;
    }

    const { overlapLines, overlapScore } = computeOverlap(
      prFile.changedLines,
      mainFile.changedLines,
    );

    const risk = assessRisk({
      overlapScore,
      prChangeSize: prFile.additions + prFile.deletions,
      mainChangeSize: mainFile.additions + mainFile.deletions,
      prStatus: prFile.status,
      mainStatus: mainFile.status,
    });

    driftedFiles.push({
      filename: prFile.filename,
      prChanges: prFile.additions + prFile.deletions,
      mainChanges: mainFile.additions + mainFile.deletions,
      overlapScore,
      overlapLines,
      prStatus: prFile.status,
      mainStatus: mainFile.status,
      risk,
    });
  }

  driftedFiles.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);

  return { prInfo, prFiles, mainFiles, driftedFiles, cleanFiles };
}

const PROXIMITY_WINDOW = 5; // lines within this range count as "nearby"

interface OverlapResult {
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

const RISK_ORDER: Record<RiskLevel, number> = { high: 0, medium: 1, low: 2 };

interface RiskInput {
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

  if (overlapScore > 0.4) return "high";

  if (overlapScore > 0.2 && mainChangeSize > 20) return "high";

  if (overlapScore > 0.15 || mainChangeSize > 50) return "medium";

  return "low";
}
