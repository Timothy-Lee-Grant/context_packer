import { describe, expect, it } from "vitest";
import { parseArgs, parseSize } from "./cli.js";

/** Build a fake argv: [node, script, ...args]. */
function argv(...args: string[]): string[] {
  return ["node", "git-context-pack", ...args];
}

describe("parseSize", () => {
  it("parses units", () => {
    expect(parseSize("2048")).toBe(2048);
    expect(parseSize("256kb")).toBe(256 * 1024);
    expect(parseSize("1mb")).toBe(1024 * 1024);
    expect(parseSize("1.5kb")).toBe(1536);
  });

  it("throws on garbage", () => {
    expect(() => parseSize("big")).toThrow();
  });
});

describe("parseArgs", () => {
  it("defaults root to '.' and no flags", () => {
    const { options, quiet } = parseArgs(argv());
    expect(options.root).toBe(".");
    expect(options.clipboard).toBe(false);
    expect(quiet).toBe(false);
  });

  it("parses extensions into a normalized list", () => {
    const { options } = parseArgs(argv("-e", ".ts, js ,JSON"));
    expect(options.extensions).toEqual(["ts", "js", "json"]);
  });

  it("collects repeated --exclude flags", () => {
    const { options } = parseArgs(argv("-x", "*.snap", "-x", "fixtures/"));
    expect(options.exclude).toEqual(["*.snap", "fixtures/"]);
  });

  it("captures dir, output, clipboard, and quiet", () => {
    const { options, quiet } = parseArgs(
      argv("src", "-d", "backend", "-o", "ctx.md", "-c", "-q"),
    );
    expect(options.root).toBe("src");
    expect(options.dir).toBe("backend");
    expect(options.output).toBe("ctx.md");
    expect(options.clipboard).toBe(true);
    expect(quiet).toBe(true);
  });

  it("parses --max-size into bytes", () => {
    const { options } = parseArgs(argv("--max-size", "128kb"));
    expect(options.maxFileSize).toBe(128 * 1024);
  });
});
