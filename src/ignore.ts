import { readFile } from "node:fs/promises";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

/**
 * Directories and files that should always be skipped, regardless of whether
 * a .gitignore exists. These are near-universal noise for LLM context.
 */
export const BUILT_IN_IGNORES: string[] = [
  ".git/",
  "node_modules/",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  ".nuxt/",
  ".cache/",
  ".DS_Store",
  // Common lockfiles — large, low signal.
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
];

/**
 * Build an ignore matcher seeded with the built-in defaults, the root
 * .gitignore (if present), and any extra patterns from CLI flags.
 *
 * The returned matcher expects POSIX-style relative paths.
 */
export async function buildIgnore(
  root: string,
  extraPatterns: string[] = [],
): Promise<Ignore> {
  const ig = ignore();
  ig.add(BUILT_IN_IGNORES);

  const gitignorePath = path.join(root, ".gitignore");
  try {
    const contents = await readFile(gitignorePath, "utf8");
    ig.add(contents);
  } catch {
    // No .gitignore is fine — built-in defaults still apply.
  }

  if (extraPatterns.length > 0) {
    ig.add(extraPatterns);
  }

  return ig;
}
