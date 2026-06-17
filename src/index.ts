import { resolveOptions } from "./config.js";
import { buildIgnore } from "./ignore.js";
import { walk } from "./walker.js";
import { filterFiles } from "./filter.js";
import { readFiles } from "./reader.js";
import { formatBundle } from "./formatter.js";
import { estimateTokens } from "./tokens.js";
import { deliver } from "./output.js";
import { buildReport } from "./report.js";

/** Format today's date as YYYY-MM-DD for the bundle header. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Phase 4 entry point: walk → filter → read → format → estimate → emit.
 * Delivers the bundle to clipboard/file/stdout and prints a summary with an
 * estimated token count. The full CLI argument layer arrives in Phase 5.
 */
async function main(): Promise<void> {
  const options = resolveOptions();

  const ig = await buildIgnore(options.root, options.exclude);
  const walked = await walk(options.root, ig);
  const { kept, skipped: filteredOut } = await filterFiles(walked, options);
  const { files, skipped: unreadable } = await readFiles(kept);

  const bundle = formatBundle({ files, generatedOn: today() });
  const tokenEstimate = estimateTokens(bundle);

  const delivery = await deliver(bundle, {
    clipboard: options.clipboard,
    output: options.output,
  });

  const report = buildReport({
    fileCount: files.length,
    charCount: bundle.length,
    tokenEstimate,
    tokenWarnThreshold: options.tokenWarnThreshold,
    skipped: [...filteredOut, ...unreadable],
    delivery,
  });
  console.error(report);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
