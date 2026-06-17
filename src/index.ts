import { resolveOptions } from "./config.js";
import { buildIgnore } from "./ignore.js";
import { walk } from "./walker.js";
import { filterFiles } from "./filter.js";
import { readFiles } from "./reader.js";

/**
 * Phase 2 entry point: walk → filter → read. Prints the files that would be
 * bundled plus a summary of what was skipped and why. Markdown formatting,
 * token estimation, and the full CLI layer arrive in later phases.
 */
async function main(): Promise<void> {
  const options = resolveOptions();

  const ig = await buildIgnore(options.root, options.exclude);
  const walked = await walk(options.root, ig);
  const { kept, skipped: filteredOut } = await filterFiles(walked, options);
  const { files, skipped: unreadable } = await readFiles(kept);

  const skipped = [...filteredOut, ...unreadable];

  for (const file of files) {
    const tag = file.language ? ` [${file.language}]` : "";
    console.log(`${file.relativePath}${tag} — ${file.contents.length} chars`);
  }

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
