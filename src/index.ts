import pc from "picocolors";
import { parseArgs } from "./cli.js";
import { resolveOptions } from "./config.js";
import { buildIgnore } from "./ignore.js";
import { runFocus } from "./interactive.js";
import { pack } from "./pack.js";
import { deliver } from "./output.js";
import { buildReport } from "./report.js";
import { createSpinner } from "./spinner.js";

/**
 * CLI entry point. Parses arguments, optionally runs interactive focus mode,
 * runs the pack pipeline behind a spinner, delivers the bundle to the
 * requested sink(s), and prints a summary — unless --quiet or non-interactive.
 */
async function main(): Promise<void> {
  const { options: raw, quiet, interactive } = parseArgs(process.argv);
  const options = resolveOptions(raw);

  // Interactive focus mode: let the user pick what to include.
  if (interactive) {
    const ig = await buildIgnore(options.root, options.exclude);
    const selection = await runFocus(options.root, ig);
    if (!selection) {
      console.error(pc.yellow("Nothing selected — exiting."));
      return;
    }
    options.include = selection;
  }

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
