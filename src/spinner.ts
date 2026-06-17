import type { Ora } from "ora";

/** A no-op spinner used when output is non-interactive or quiet. */
const NULL_SPINNER = {
  update(_text: string): void {},
  stop(): void {},
};

export type Spinner = typeof NULL_SPINNER;

/**
 * Create a spinner only when it makes sense: stderr is a TTY, the user did not
 * pass --quiet, and NO_COLOR-style non-interactive conditions are absent.
 * Otherwise return a silent no-op so logs stay clean when piped.
 *
 * The spinner writes to stderr so it never contaminates a stdout bundle.
 */
export async function createSpinner(quiet: boolean): Promise<Spinner> {
  const interactive = process.stderr.isTTY && !quiet;
  if (!interactive) return NULL_SPINNER;

  try {
    const { default: ora } = await import("ora");
    const instance: Ora = ora({ stream: process.stderr }).start();
    return {
      update(text: string): void {
        instance.text = text;
      },
      stop(): void {
        instance.stop();
      },
    };
  } catch {
    return NULL_SPINNER;
  }
}
