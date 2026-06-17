import path from "node:path";
import { buildIgnore } from "./ignore.js";
import { walk } from "./walker.js";

/**
 * Phase 1 entry point: walk the current directory, respecting .gitignore,
 * and print the filtered file list. Formatting, filtering, token estimation,
 * and the full CLI layer arrive in later phases.
 */
async function main(): Promise<void> {
  const root = path.resolve(process.cwd());
  const ig = await buildIgnore(root);
  const files = await walk(root, ig);

  for (const file of files) {
    console.log(file.relativePath);
  }
  console.error(`\n${files.length} files (after ignore rules).`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
