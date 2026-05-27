import { Command } from "commander";
import chalk from "chalk";
import { GitHubClient } from "./github.js";
import { analyzePR } from "./analyzer.js";
import { render } from "./reporter.js";
import type { CLIOptions, OutputFormat } from "./types.js";

const DEFAULT_FORMAT: OutputFormat = "table";
const DEFAULT_THRESHOLD = 0;

export function buildCLI(): Command {
  const program = new Command();

  program
    .name("prcheck")
    .description(
      "Detect semantic drift in pull requests before it becomes a merge disaster.",
    )
    .version("0.1.0")
    .requiredOption("--repo <owner/repo>", "Repository in owner/repo format")
    .requiredOption("--pr <number>", "Pull request number", parseInt)
    .option(
      "--comment",
      "Post results as a comment on the PR (requires write access)",
      false,
    )
    .option(
      "--format <format>",
      "Output format: table | markdown | json",
      DEFAULT_FORMAT,
    )
    .option(
      "--threshold <number>",
      "Exit with code 1 if drifted file count exceeds this (useful for CI)",
      parseInt,
      DEFAULT_THRESHOLD,
    )
    .option(
      "--token <token>",
      "GitHub token (defaults to GITHUB_TOKEN env var)",
    )
    .option("--verbose", "Show overlapping line numbers per file", false)
    .option(
      "--ai",
      "Use Claude to explain drift in plain English (requires ANTHROPIC_API_KEY)",
      false,
    )
    .addHelpText(
      "after",
      `
Examples:
  $ prcheck --repo owner/repo --pr 412
  $ prcheck --repo owner/repo --pr 412 --comment
  $ prcheck --repo owner/repo --pr 412 --format json
  $ prcheck --repo owner/repo --pr 412 --verbose
  $ prcheck --repo owner/repo --pr 412 --threshold 3
  $ prcheck --repo owner/repo --pr 412 --ai
    `,
    );

  return program;
}

export async function run(opts: CLIOptions): Promise<void> {
  const client = new GitHubClient(opts.repo, opts.token);

  console.log(chalk.cyan(`🔍 Analyzing PR #${opts.pr} in ${opts.repo}...\n`));

  const report = await analyzePR(client, opts.pr);

  const output = render(report, { format: opts.format, verbose: opts.verbose });
  console.log(output);

  if (opts.comment) {
    if (report.driftedFiles.length === 0) {
      console.log(chalk.gray("\nNo drift to report — skipping PR comment."));
    } else {
      const md = render(report, { format: "markdown" });
      await client.postComment(opts.pr, md);
      console.log(chalk.green("\n✅ Comment posted to PR."));
    }
  }

  if (opts.threshold > 0 && report.driftedFiles.length > opts.threshold) {
    console.error(
      chalk.red(
        `\n❌ Drift threshold exceeded: ${report.driftedFiles.length} drifted file(s) > threshold of ${opts.threshold}.`,
      ),
    );
    process.exit(1);
  }
}
