import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deliver } from "./output.js";

let dir: string;
let stdoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "gcp-out-"));
  stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
});

afterEach(async () => {
  stdoutSpy.mockRestore();
  await rm(dir, { recursive: true, force: true });
});

describe("deliver", () => {
  it("writes to a file when output is set", async () => {
    const target = path.join(dir, "bundle.md");
    const result = await deliver("hello", { clipboard: false, output: target });

    expect(result.toFile).toBe(target);
    expect(await readFile(target, "utf8")).toBe("hello");
    expect(result.toStdout).toBe(false);
  });

  it("falls back to stdout when no sink is requested", async () => {
    const result = await deliver("hi", { clipboard: false });
    expect(result.toStdout).toBe(true);
    expect(stdoutSpy).toHaveBeenCalledWith("hi");
  });

  it("can force stdout alongside a file", async () => {
    const target = path.join(dir, "b.md");
    const result = await deliver("x", {
      clipboard: false,
      output: target,
      alsoStdout: true,
    });
    expect(result.toFile).toBe(target);
    expect(result.toStdout).toBe(true);
  });
});
