import { describe, expect, it } from "vitest";
import { languageFor } from "./languages.js";

describe("languageFor", () => {
  it("maps common extensions", () => {
    expect(languageFor("src/index.ts")).toBe("typescript");
    expect(languageFor("a/b/c.py")).toBe("python");
    expect(languageFor("style.css")).toBe("css");
  });

  it("maps special filenames", () => {
    expect(languageFor("Dockerfile")).toBe("dockerfile");
    expect(languageFor("project/Makefile")).toBe("makefile");
    expect(languageFor(".gitignore")).toBe("gitignore");
  });

  it("returns empty for unknown extensions", () => {
    expect(languageFor("data.xyz")).toBe("");
    expect(languageFor("noext")).toBe("");
  });
});
