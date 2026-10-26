import { describe, expect, it } from "vitest";
import { baseName, joinPath, parentPath, splitPath } from "./path";

describe("joinPath", () => {
  it("joins root and name", () => expect(joinPath("/", "a")).toBe("/a"));
  it("joins dir and name", () => expect(joinPath("/a", "b")).toBe("/a/b"));
  it("tolerates trailing slash", () => expect(joinPath("/a/", "b")).toBe("/a/b"));
});

describe("parentPath", () => {
  it("returns parent dir", () => expect(parentPath("/a/b")).toBe("/a"));
  it("returns root for top-level", () => expect(parentPath("/a")).toBe("/"));
  it("root stays root", () => expect(parentPath("/")).toBe("/"));
});

describe("baseName", () => {
  it("returns last segment", () => expect(baseName("/a/b.txt")).toBe("b.txt"));
  it("root has empty name", () => expect(baseName("/")).toBe(""));
});

describe("splitPath", () => {
  it("splits into segments", () => expect(splitPath("/a/b")).toEqual(["a", "b"]));
  it("root is empty", () => expect(splitPath("/")).toEqual([]));
});
