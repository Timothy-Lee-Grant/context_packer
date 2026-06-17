import { resolveOptions } from "./config.js";
import { buildIgnore } from "./ignore.js";
import { walk } from "./walker.js";
import { filterFiles } from "./filter.js";
import { readFiles } from "./reader.js";
import { formatBundle } from "./formatter.js";

/** Format today's date as YYYY-MM-DD for the bundle header. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Phase 3 entry point: walk → filter → read → format. Emits the Markdown
 * bundle to stdout and a short summary (file/skip counts) to stderr. Token
 * estimation, output sinks, and the full CLI layer arrive in later phases.
 */
async function main(): Promise<void> {
  const options = resolveOptions();

  const ig = await buildIgnore(options.root, options.exclude);
  const walked = await walk(options.root, ig);
  const { kept, skipped: filteredOut } = await filterFiles(walked, options);
  const { files, skipped: unreadable } = await readFiles(kept);

  const bundle = formatBundle({ files, generatedOn: today() });
  process.stdout.write(bundle);

  const skipped = [...filteredOut, ...unreadable];
  console.error(`\n${files.length} files included.`);
  if (skipped.length > 0) {
    const byReason = skipped.reduce<Record<string, number>>((acc, s) => {
      acc[s.reason] = (acc[s.reason] ?? 0) + 1;
      return acc;
    }, {});
    const summary = Object.entries(byReason)
      .map(([reason, count]) => `${count} ${reason}`)
      .join(", ");
    console.error(`${skipped.length} skipped (${summary}).`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
