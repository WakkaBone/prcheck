export interface GHPullRequest {
  number: number;
  title: string;
  base: { ref: string; sha: string };
  head: { ref: string; sha: string };
}

export interface GHFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

export interface GHCompare {
  merge_base_commit: { sha: string };
  files?: GHFile[];
}
