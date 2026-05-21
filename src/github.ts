import axios, { AxiosInstance } from "axios";
import type { PRInfo, FileDiff } from "./types.js";
import type { GHPullRequest, GHFile, GHCompare } from "./github-types.js";
import { toFileDiff } from "./patch.js";

export class GitHubClient {
  private readonly http: AxiosInstance;
  private readonly repo: string;

  constructor(repo: string, token?: string) {
    const resolvedToken = token ?? process.env.GITHUB_TOKEN;
    if (!resolvedToken) {
      throw new Error(
        "GitHub token required. Set the GITHUB_TOKEN environment variable or use --token."
      );
    }

    this.repo = repo;
    this.http = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Authorization: `Bearer ${resolvedToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  }

  async getPRInfo(prNumber: number): Promise<PRInfo> {
    const { data: pr } = await this.http.get<GHPullRequest>(
      `/repos/${this.repo}/pulls/${prNumber}`
    );

    const mergeBaseSha = await this.getMergeBase(pr.base.sha, pr.head.sha);

    return {
      number: pr.number,
      title: pr.title,
      baseBranch: pr.base.ref,
      headBranch: pr.head.ref,
      baseSha: pr.base.sha,
      headSha: pr.head.sha,
      mergeBaseSha,
    };
  }

  async getPRFiles(prNumber: number): Promise<FileDiff[]> {
    const { data: files } = await this.http.get<GHFile[]>(
      `/repos/${this.repo}/pulls/${prNumber}/files`,
      { params: { per_page: 100 } }
    );

    return files.map(toFileDiff);
  }

  async getMainBranchChanges(baseBranch: string, mergeBaseSha: string): Promise<FileDiff[]> {
    const { data: compare } = await this.http.get<GHCompare>(
      `/repos/${this.repo}/compare/${mergeBaseSha}...${baseBranch}`
    );

    return (compare.files ?? []).map(toFileDiff);
  }

  async postComment(prNumber: number, body: string): Promise<void> {
    await this.http.post(`/repos/${this.repo}/issues/${prNumber}/comments`, { body });
  }

  private async getMergeBase(baseSha: string, headSha: string): Promise<string> {
    const { data: compare } = await this.http.get<GHCompare>(
      `/repos/${this.repo}/compare/${baseSha}...${headSha}`
    );
    return compare.merge_base_commit.sha;
  }
}
