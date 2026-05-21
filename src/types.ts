export interface PRInfo {
  number: number;
  title: string;
  baseBranch: string;
  headBranch: string;
  baseSha: string;
  headSha: string;
  mergeBaseSha: string;
}

export type FileStatus =
  | "added"
  | "modified"
  | "removed"
  | "renamed"
  | "copied"
  | "changed";

export interface FileDiff {
  filename: string;
  status: FileStatus;
  additions: number;
  deletions: number;
  patch: string | null;
  changedLines: number[];
}

export type RiskLevel = "high" | "medium" | "low";

export interface DriftedFile {
  filename: string;
  prChanges: number;
  mainChanges: number;
  overlapScore: number;
  overlapLines: number[];
  prStatus: FileStatus;
  mainStatus: FileStatus;
  risk: RiskLevel;
  aiInsight?: string;
}

export interface DriftReport {
  prInfo: PRInfo;
  prFiles: FileDiff[];
  mainFiles: FileDiff[];
  driftedFiles: DriftedFile[];
  cleanFiles: string[];
}

export type OutputFormat = "table" | "markdown" | "json";

export interface CLIOptions {
  repo: string;
  pr: number;
  comment: boolean;
  format: OutputFormat;
  threshold: number;
  token?: string;
  verbose: boolean;
  ai: boolean;
}
