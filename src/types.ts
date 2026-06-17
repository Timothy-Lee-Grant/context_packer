/**
 * Shared types used across the git-context-pack pipeline.
 * The pipeline stages flow: walk → filter → read → format → estimate → emit.
 */

/** A single file discovered by the walker, before its contents are read. */
export interface FileEntry {
  /** Path relative to the root, using POSIX separators for deterministic output. */
  relativePath: string;
  /** Absolute path on disk, used for reading. */
  absolutePath: string;
  /** File size in bytes, from fs.stat. */
  size: number;
}

/** Resolved options that drive a single run of the tool. */
export interface Options {
  /** Root directory to walk (absolute). */
  root: string;
  /** Optional subdirectory to scope to, relative to root. */
  dir?: string;
  /** Allowed file extensions (without dots), or undefined for "all". */
  extensions?: string[];
  /** Extra ignore patterns supplied via flags. */
  exclude: string[];
  /** Maximum size in bytes before a file is skipped. */
  maxFileSize: number;
}

/** Why a candidate file did not make it into the bundle. */
export type SkipReason = "binary" | "too-large" | "unreadable" | "filtered";

/** A file that was discovered but deliberately excluded, with the reason. */
export interface SkippedFile {
  relativePath: string;
  reason: SkipReason;
}

/** A file that survived filtering and had its contents read. */
export interface ReadFile {
  relativePath: string;
  /** UTF-8 text contents of the file. */
  contents: string;
  /** Markdown language tag inferred from the extension (may be empty). */
  language: string;
  /** Size in bytes. */
  size: number;
}

/** The outcome of the filter stage: what to read, and what was dropped. */
export interface FilterResult {
  kept: FileEntry[];
  skipped: SkippedFile[];
}
