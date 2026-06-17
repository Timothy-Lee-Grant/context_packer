import { describe, expect, it } from "vitest";
import { estimateTokens, humanTokens, formatNumber } from "./tokens.js";

describe("estimateTokens", () => {
  it("uses the ~4 chars per token heuristic", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("abcde")).toBe(2); // ceil(5/4)
    expect(estimateTokens("a".repeat(400))).toBe(100);
  });
});

describe("humanTokens", () => {
  it("formats compactly", () => {
    expect(humanTokens(0)).toBe("0");
    expect(humanTokens(999)).toBe("999");
    expect(humanTokens(1234)).toBe("1.2k");
    expect(humanTokens(45000)).toBe("45.0k");
    expect(humanTokens(128000)).toBe("128k");
    expect(humanTokens(2_500_000)).toBe("2.5M");
  });
});

describe("formatNumber", () => {
  it("adds thousands separators", () => {
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(1000)).toBe("1,000");
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
