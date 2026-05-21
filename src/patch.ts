import type { FileDiff, FileStatus } from "./types.js";
import type { GHFile } from "./github-types.js";

export function extractChangedLines(patch: string | undefined): number[] {
  if (!patch) return [];

  const lines: number[] = [];
  let currentLine = 0;

  for (const line of patch.split("\n")) {
    if (line.startsWith("@@")) {
      const match = line.match(/\+(\d+)/);
      if (match) {
        currentLine = parseInt(match[1], 10) - 1;
      }
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      currentLine++;
      lines.push(currentLine);
    } else if (!line.startsWith("-")) {
      currentLine++;
    }
  }

  return lines;
}

export function toFileDiff(f: GHFile): FileDiff {
  return {
    filename: f.filename,
    status: (f.status as FileStatus) ?? "modified",
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
    changedLines: extractChangedLines(f.patch),
  };
}
