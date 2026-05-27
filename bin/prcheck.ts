#!/usr/bin/env node
import { buildCLI, run } from "../src/cli.js";
import type { CLIOptions } from "../src/types.js";

const program = buildCLI();
program.parse();

const opts = program.opts<CLIOptions>();

run(opts).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n❌ Error: ${message}`);
  process.exit(1);
});
