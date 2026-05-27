import type { DriftedFile, DriftReport } from "./types.js";
import type { GitHubClient } from "./github.js";
import { computeOverlap, assessRisk, RISK_ORDER } from "./overlap.js";

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
