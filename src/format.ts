import type { RiskLevel, DriftedFile } from "./types.js";

export const COL = { file: 48, pr: 10, main: 12, overlap: 9, risk: 6 } as const;
export const DIVIDER_WIDTH =
  COL.file + COL.pr + COL.main + COL.overlap + COL.risk + 4;

const RISK_EMOJI: Record<RiskLevel, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
};

export function riskEmoji(risk: RiskLevel): string {
  return RISK_EMOJI[risk];
}

const ADVICE: Record<RiskLevel, string> = {
  high:
    "High-risk drift found. Re-read the drifted files on main before requesting review. " +
    "Consider rebasing to resolve conflicts early.",
  medium:
    "Moderate drift detected. These files changed on both branches — " +
    "verify the logic is still consistent after merge.",
  low: "Low-risk drift. Files overlap slightly but changes appear minimal.",
};

export function summaryAdvice(driftedFiles: DriftedFile[]): string {
  if (driftedFiles.length === 0) return "No drift detected.";
  return ADVICE[driftedFiles[0].risk]; // already sorted, first = worst
}

export function formatLineRanges(lines: number[]): string {
  if (lines.length === 0) return "";

  const ranges: string[] = [];
  let start = lines[0];
  let end = lines[0];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === end + 1) {
      end = lines[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = lines[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);

  return ranges.join(", ");
}

export function pad(s: string, width: number): string {
  return s.padEnd(width);
}

export function padLeft(s: string, width: number): string {
  return s.padStart(width);
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `…${s.slice(-(max - 1))}` : s;
}

export function formatPct(score: number): string {
  return `${(score * 100).toFixed(0)}%`;
}
