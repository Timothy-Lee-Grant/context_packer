import { open } from "node:fs/promises";
import path from "node:path";
import type { FileEntry, FilterResult, Options, SkippedFile } from "./types.js";

/** Number of leading bytes sampled to decide whether a file is binary. */
const BINARY_SNIFF_BYTES = 4096;

/**
 * Extensions that are always treated as binary regardless of content, so we
 * never even open large media/compiled assets. Lowercased, without dots.
 */
const BINARY_EXTENSIONS = new Set([
  // images
  "png", "jpg", "jpeg", "gif", "bmp", "webp", "ico", "tiff", "avif",
  // fonts
  "woff", "woff2", "ttf", "otf", "eot",
  // media
  "mp3", "wav", "flac", "ogg", "mp4", "mov", "avi", "mkv", "webm",
  // archives
  "zip", "tar", "gz", "tgz", "bz2", "7z", "rar",
  // compiled / binary
  "exe", "dll", "so", "dylib", "bin", "o", "a", "class", "wasm",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  // db / misc
  "db", "sqlite", "lockb", "node",
]);

function extOf(relativePath: string): string {
  return path.extname(relativePath).slice(1).toLowerCase();
}

/**
 * Sniff a file's first bytes for a NUL byte, the classic heuristic for binary
 * content. Returns true if the file looks binary or cannot be read.
 */
async function looksBinary(absolutePath: string): Promise<boolean> {
  let handle;
  try {
    handle = await open(absolutePath, "r");
    const buffer = Buffer.alloc(BINARY_SNIFF_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, BINARY_SNIFF_BYTES, 0);
    for (let i = 0; i < bytesRead; i++) {
      if (buffer[i] === 0) return true;
    }
    return false;
  } catch {
    return true; // Unreadable — treat as binary so it is skipped, not crashed on.
  } finally {
    await handle?.close();
  }
}

/**
 * Apply directory scoping, extension targeting, size caps, and binary
 * detection to the walked file list. Returns the files to read plus a
 * diagnostic list of everything skipped and why.
 */
export async function filterFiles(
  files: FileEntry[],
  options: Options,
): Promise<FilterResult> {
  const kept: FileEntry[] = [];
  const skipped: SkippedFile[] = [];

  // Normalize an optional --dir scope to a POSIX prefix.
  const scope = options.dir
    ? options.dir.split(path.sep).join("/").replace(/\/+$/, "")
    : undefined;

  const allowExt = options.extensions?.map((e) => e.toLowerCase());

  for (const file of files) {
    // Directory scoping.
    if (scope && !isWithin(file.relativePath, scope)) {
      continue; // Out of scope is silent, not a "skip" worth reporting.
    }

    const ext = extOf(file.relativePath);

    // Extension targeting (when provided).
    if (allowExt && !allowExt.includes(ext)) {
      skipped.push({ relativePath: file.relativePath, reason: "filtered" });
      continue;
    }

    // Size cap.
    if (file.size > options.maxFileSize) {
      skipped.push({ relativePath: file.relativePath, reason: "too-large" });
      continue;
    }

    // Binary detection — extension fast-path, then content sniff.
    if (BINARY_EXTENSIONS.has(ext) || (await looksBinary(file.absolutePath))) {
      skipped.push({ relativePath: file.relativePath, reason: "binary" });
      continue;
    }

    kept.push(file);
  }

  return { kept, skipped };
}

/** True if `relativePath` is the scope directory itself or sits inside it. */
function isWithin(relativePath: string, scope: string): boolean {
  return relativePath === scope || relativePath.startsWith(`${scope}/`);
}
