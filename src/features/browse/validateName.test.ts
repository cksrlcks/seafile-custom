import { describe, expect, it } from "vitest";
import { validateName } from "./validateName";

describe("validateName", () => {
  it("accepts a normal name", () => expect(validateName("보고서 v2.pdf")).toBeNull());
  it("rejects empty or whitespace", () => expect(validateName("   ")).toBe("이름을 입력하세요"));
  it("rejects slashes", () => {
    expect(validateName("a/b")).toBe("이름에 / 또는 \\ 를 쓸 수 없습니다");
    expect(validateName("a\\b")).toBe("이름에 / 또는 \\ 를 쓸 수 없습니다");
  });
  it("rejects dot names", () => {
    expect(validateName(".")).toBe("사용할 수 없는 이름입니다");
    expect(validateName("..")).toBe("사용할 수 없는 이름입니다");
  });
  it("rejects a name already in the folder", () => expect(validateName("a.txt", ["a.txt"])).toBe("같은 이름이 이미 있습니다"));
});
