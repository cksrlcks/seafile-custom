import { describe, expect, it } from "vitest";
import { resolveName, uniqueName, validateName } from "./validateName";

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

describe("uniqueName", () => {
  it("uses the base name when free", () => expect(uniqueName("새 폴더", ["a"])).toBe("새 폴더"));
  it("adds (2), (3)… when taken", () => {
    expect(uniqueName("새 폴더", ["새 폴더"])).toBe("새 폴더 (2)");
    expect(uniqueName("새 폴더", ["새 폴더", "새 폴더 (2)"])).toBe("새 폴더 (3)");
  });
});

describe("resolveName", () => {
  it("cancels a rename left unchanged", () => expect(resolveName("a.txt", "a.txt", [], false)).toEqual({ action: "cancel" }));
  it("submits a new folder left at its default name", () => expect(resolveName("새 폴더", "새 폴더", [], true)).toEqual({ action: "submit", name: "새 폴더" }));
  it("submits a changed, valid name (trimmed)", () => expect(resolveName("  보고서 ", "a.txt", [], false)).toEqual({ action: "submit", name: "보고서" }));
  it("cancels when emptied", () => expect(resolveName("  ", "새 폴더", [], true)).toEqual({ action: "cancel" }));
  it("stays editing on an invalid name", () => expect(resolveName("b", "a", ["b"], false)).toEqual({ action: "stay" }));
});
