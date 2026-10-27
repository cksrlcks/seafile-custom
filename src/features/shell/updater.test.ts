import { describe, expect, it } from "vitest";
import { noteSummary } from "./updater";

describe("noteSummary", () => {
  it("takes the first non-empty line without markdown", () => {
    expect(noteSummary("\n**macOS** 지원\n\n### 새 기능\n- a")).toBe("macOS 지원");
    expect(noteSummary(undefined)).toBeUndefined();
  });
});
