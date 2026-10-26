import { describe, expect, it } from "vitest";
import { previewKind } from "./previewKind";

describe("previewKind", () => {
  it("image, case-insensitive", () => expect(previewKind("A.PNG")).toBe("image"));
  it("markdown is text", () => expect(previewKind("readme.md")).toBe("text"));
  it("code is text", () => expect(previewKind("main.rs")).toBe("text"));
  it("pdf", () => expect(previewKind("x.pdf")).toBe("pdf"));
  it("zip has no preview", () => expect(previewKind("x.zip")).toBeNull());
  it("no extension has no preview", () => expect(previewKind("noext")).toBeNull());
});
