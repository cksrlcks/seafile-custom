import { describe, expect, it } from "vitest";
import type { Entry } from "@/storage/StorageProvider";
import { searchTree } from "./searchTree";

const d = (path: string): Entry => ({ id: path, name: path.split("/").pop()!, type: "dir", size: 0, mtime: 0, path });
const f = (path: string): Entry => ({ id: path, name: path.split("/").pop()!, type: "file", size: 1, mtime: 0, path });

const TREE: Record<string, Entry[]> = {
  "/": [d("/docs"), d("/photos"), f("/Report.pdf")],
  "/docs": [d("/docs/2025"), f("/docs/report-draft.md")],
  "/docs/2025": [f("/docs/2025/annual REPORT.xlsx")],
  "/photos": [f("/photos/beach.jpg")],
};
const list = async (p: string) => {
  if (!(p in TREE)) throw new Error("missing " + p);
  return TREE[p];
};

describe("searchTree", () => {
  it("finds case-insensitive matches in nested folders", async () => {
    const found: string[] = [];
    const r = await searchTree(list, "/", "report", (m) => found.push(...m.map((e) => e.path)));
    expect(found.sort()).toEqual(["/Report.pdf", "/docs/2025/annual REPORT.xlsx", "/docs/report-draft.md"]);
    expect(r.scanned).toBe(4);
    expect(r.truncated).toBe(false);
  });

  it("starts from the given root only", async () => {
    const found: string[] = [];
    await searchTree(list, "/docs", "report", (m) => found.push(...m.map((e) => e.path)));
    expect(found.sort()).toEqual(["/docs/2025/annual REPORT.xlsx", "/docs/report-draft.md"]);
  });

  it("matches folder names too", async () => {
    const found: string[] = [];
    await searchTree(list, "/", "2025", (m) => found.push(...m.map((e) => e.path)));
    expect(found).toEqual(["/docs/2025"]);
  });

  it("stops after maxDirs and reports truncation", async () => {
    const r = await searchTree(list, "/", "x", () => {}, { maxDirs: 2, concurrency: 1 });
    expect(r.scanned).toBe(2);
    expect(r.truncated).toBe(true);
  });

  it("skips folders that fail to load", async () => {
    const broken = async (p: string) => (p === "/docs" ? Promise.reject(new Error("403")) : list(p));
    const found: string[] = [];
    await searchTree(broken, "/", "report", (m) => found.push(...m.map((e) => e.path)));
    expect(found).toEqual(["/Report.pdf"]);
  });

  it("stops when aborted", async () => {
    const ctrl = new AbortController();
    const found: string[] = [];
    const slow = async (p: string) => {
      if (p !== "/") ctrl.abort();
      return list(p);
    };
    await searchTree(slow, "/", "report", (m) => found.push(...m.map((e) => e.path)), { signal: ctrl.signal, concurrency: 1 });
    expect(found).toEqual(["/Report.pdf"]);
  });
});
