import { readdir } from "node:fs/promises";
import type { Ignore } from "ignore";
import { changedFiles } from "./git.js";

/** A selectable item in the focus-mode checkbox list. */
export interface FocusChoice {
  /** Label shown to the user. */
  name: string;
  /** POSIX-relative path used as the include value. */
  value: string;
  /** Whether it should start checked. */
  checked: boolean;
}

/**
 * Build the list of choices for focus mode: every non-ignored top-level entry
 * (directories first), plus any git-changed files grouped at the top and
 * pre-checked for convenience. Pure enough to unit-test by injecting the
 * directory entries and changed-file list.
 */
export function buildChoices(
  topLevel: { name: string; isDir: boolean }[],
  changed: string[],
): FocusChoice[] {
  const choices: FocusChoice[] = [];
  const changedSet = new Set(changed);

  // Changed files first, pre-checked.
  for (const file of changed) {
    choices.push({ name: `★ ${file} (changed)`, value: file, checked: true });
  }

  // Top-level entries: directories before files, alphabetical within each.
  const sorted = [...topLevel].sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  for (const entry of sorted) {
    // Skip a top-level file already represented in the changed group.
    if (!entry.isDir && changedSet.has(entry.name)) continue;
    const label = entry.isDir ? `${entry.name}/` : entry.name;
    choices.push({ name: label, value: entry.name, checked: false });
  }

  return choices;
}

/** Read non-ignored top-level entries of the root directory. */
async function topLevelEntries(
  root: string,
  ig: Ignore,
): Promise<{ name: string; isDir: boolean }[]> {
  const dirents = await readdir(root, { withFileTypes: true });
  const result: { name: string; isDir: boolean }[] = [];
  for (const dirent of dirents) {
    const isDir = dirent.isDirectory();
    const matchPath = isDir ? `${dirent.name}/` : dirent.name;
    if (ig.ignores(matchPath)) continue;
    result.push({ name: dirent.name, isDir });
  }
  return result;
}

/**
 * Run the interactive focus prompt and return the chosen include paths.
 * Returns undefined if the user selects nothing (caller can treat that as
 * "include everything" or abort, as appropriate).
 */
export async function runFocus(
  root: string,
  ig: Ignore,
): Promise<string[] | undefined> {
  const [entries, changed] = await Promise.all([
    topLevelEntries(root, ig),
    changedFiles(root),
  ]);

  const choices = buildChoices(entries, changed);
  if (choices.length === 0) return undefined;

  const { checkbox } = await import("@inquirer/prompts");
  const selected = await checkbox({
    message: "Select directories and files to include:",
    choices: choices.map((c) => ({
      name: c.name,
      value: c.value,
      checked: c.checked,
    })),
    pageSize: 20,
  });

  return selected.length > 0 ? selected : undefined;
}
