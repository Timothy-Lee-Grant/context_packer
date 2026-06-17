import { writeFile } from "node:fs/promises";
import path from "node:path";

/** Where the bundle was delivered, for reporting back to the user. */
export interface DeliveryResult {
  toStdout: boolean;
  toClipboard: boolean;
  toFile?: string;
  /** Non-fatal problems (e.g. clipboard unavailable in a headless env). */
  warnings: string[];
}

export interface DeliveryOptions {
  clipboard: boolean;
  output?: string;
  /** Force stdout even when another sink is chosen. */
  alsoStdout?: boolean;
}

/**
 * Deliver the bundle to the requested sinks. When neither clipboard nor file
 * is requested, the bundle goes to stdout. Clipboard failures (common in CI or
 * headless shells) are downgraded to warnings rather than hard errors.
 */
export async function deliver(
  bundle: string,
  options: DeliveryOptions,
): Promise<DeliveryResult> {
  const warnings: string[] = [];
  const result: DeliveryResult = {
    toStdout: false,
    toClipboard: false,
    warnings,
  };

  if (options.output) {
    const target = path.resolve(options.output);
    await writeFile(target, bundle, "utf8");
    result.toFile = target;
  }

  if (options.clipboard) {
    try {
      const { default: clipboard } = await import("clipboardy");
      await clipboard.write(bundle);
      result.toClipboard = true;
    } catch {
      warnings.push(
        "Could not access the clipboard (headless environment?). " +
          "Use --output to write to a file instead.",
      );
    }
  }

  // Default to stdout only when no other sink succeeded, unless forced.
  const noSink = !result.toFile && !result.toClipboard;
  if (options.alsoStdout || noSink) {
    process.stdout.write(bundle);
    result.toStdout = true;
  }

  return result;
}
