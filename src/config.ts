import path from "node:path";
import type { Options } from "./types.js";

/** Default maximum file size before a file is skipped as "too-large" (256 KB). */
export const DEFAULT_MAX_FILE_SIZE = 256 * 1024;

/** Raw, partially-specified options (e.g. from CLI flags). */
export interface RawOptions {
  root?: string;
  dir?: string;
  extensions?: string[];
  exclude?: string[];
  maxFileSize?: number;
}

/** Normalize a comma/space separated extension list into clean lowercase tokens. */
export function parseExtensions(input?: string): string[] | undefined {
  if (!input) return undefined;
  const tokens = input
    .split(/[,\s]+/)
    .map((t) => t.trim().replace(/^\./, "").toLowerCase())
    .filter(Boolean);
  return tokens.length > 0 ? tokens : undefined;
}

/** Resolve raw options and defaults into a fully-specified Options object. */
export function resolveOptions(raw: RawOptions = {}): Options {
  return {
    root: path.resolve(raw.root ?? process.cwd()),
    dir: raw.dir,
    extensions: raw.extensions,
    exclude: raw.exclude ?? [],
    maxFileSize: raw.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
  };
}
