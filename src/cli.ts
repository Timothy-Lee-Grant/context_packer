import { Command } from "commander";
import { parseExtensions, type RawOptions } from "./config.js";

export interface ParsedArgs {
  options: RawOptions;
  /** True when a TTY-aware spinner/colors should be suppressed. */
  quiet: boolean;
}

/** Raw flag shape as commander hands it back, before normalization. */
interface RawFlags {
  dir?: string;
  ext?: string;
  exclude?: string[];
  clipboard?: boolean;
  output?: string;
  maxSize?: string;
  quiet?: boolean;
}

/** Parse a human size like "256kb", "1mb", "2048" into bytes. */
export function parseSize(input: string): number {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/i.exec(input.trim());
  if (!match) {
    throw new Error(`Invalid size: "${input}" (try e.g. 256kb, 1mb, 4096)`);
  }
  const value = Number(match[1]);
  const unit = (match[2] ?? "b").toLowerCase();
  const multiplier =
    unit === "gb"
      ? 1024 ** 3
      : unit === "mb"
        ? 1024 ** 2
        : unit === "kb"
          ? 1024
          : 1;
  return Math.floor(value * multiplier);
}

/** Collect repeated --exclude flags into an array. */
function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value];
}

/**
 * Build the commander program. Exposed so tests can parse argv without the
 * program calling process.exit.
 */
export function buildProgram(): Command {
  const program = new Command();

  program
    .name("git-context-pack")
    .description(
      "Bundle your codebase into clean, token-efficient context for any LLM.",
    )
    .version("0.1.0")
    .argument("[root]", "directory to pack", ".")
    .option("-d, --dir <path>", "limit to a subdirectory (e.g. src/backend)")
    .option("-e, --ext <list>", "only include these extensions (e.g. ts,js,json)")
    .option(
      "-x, --exclude <pattern>",
      "extra ignore pattern (repeatable)",
      collect,
      [],
    )
    .option("-c, --clipboard", "copy the bundle to the clipboard")
    .option("-o, --output <file>", "write the bundle to a file")
    .option("--max-size <size>", "skip files larger than this (e.g. 256kb)")
    .option("-q, --quiet", "suppress the spinner and summary")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ git-context-pack                      Pack the current repo to stdout",
        "  $ git-context-pack -c                    Pack and copy to the clipboard",
        "  $ git-context-pack -d src -e ts,json -c  Backend TypeScript/JSON to clipboard",
        "  $ git-context-pack -o context.md         Write the bundle to a file",
      ].join("\n"),
    );

  return program;
}

/**
 * Parse argv into normalized options. `argv` should be the full process argv
 * (including node + script) or a sliced array; commander handles both.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const program = buildProgram();
  program.parse(argv);

  const flags = program.opts<RawFlags>();
  const root = program.args[0] ?? ".";

  const options: RawOptions = {
    root,
    dir: flags.dir,
    extensions: parseExtensions(flags.ext),
    exclude: flags.exclude ?? [],
    clipboard: flags.clipboard ?? false,
    output: flags.output,
    maxFileSize: flags.maxSize ? parseSize(flags.maxSize) : undefined,
  };

  return { options, quiet: flags.quiet ?? false };
}
