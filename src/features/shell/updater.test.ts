import { describe, expect, it } from "vitest";
import { noteText } from "./updater";

describe("noteText", () => {
  it("strips markdown and blank lines, bullets lists", () => {
    expect(noteText("\n**macOS** 지원\n\n### 새 기능\n- a")).toBe("macOS 지원\n새 기능\n• a");
    expect(noteText(undefined)).toBeUndefined();
  });
});
