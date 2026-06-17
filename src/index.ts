import { parseArgs } from "./cli.js";
import { resolveOptions } from "./config.js";
import { pack } from "./pack.js";
import { deliver } from "./output.js";
import { buildReport } from "./report.js";
import { createSpinner } from "./spinner.js";

/**
 * CLI entry point. Parses arguments, runs the pack pipeline behind a spinner,
 * delivers the bundle to the requested sink(s), and prints a summary — unless
 * --quiet is set or output is non-interactive.
 */
async function main(): Promise<void> {
  const { options: raw, quiet } = parseArgs(process.argv);
  const options = resolveOptions(raw);

  const spinner = await createSpinner(quiet);
  let result;
  try {
    result = await pack(options, (stage) => spinner.update(stage));
  } finally {
    spinner.stop();
  }

  const delivery = await deliver(result.bundle, {
    clipboard: options.clipboard,
    output: options.output,
  });

  if (!quiet) {
    const report = buildReport({
      fileCount: result.fileCount,
      charCount: result.bundle.length,
      tokenEstimate: result.tokenEstimate,
      tokenWarnThreshold: options.tokenWarnThreshold,
      skipped: result.skipped,
      delivery,
    });
    console.error(report);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
