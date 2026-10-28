import { describe, expect, it, vi } from "vitest";
import { DownloadQueue } from "@/features/download/downloadQueue";
import { UploadQueue } from "@/features/upload/uploadQueue";
import { MockProvider } from "@/storage/mock/MockProvider";
import { callTool, normalizeDir, resolveTarget, type ToolCtx, type ToolResult } from "./tools";

function makeCtx(over: Partial<ToolCtx> = {}): ToolCtx {
  const storage = new MockProvider("t");
  return {
    storage,
    uploads: new UploadQueue(storage),
    downloads: new DownloadQueue(async () => {}),
    searchIndex: () => ({ entries: [], loading: false }),
    readLocalFile: async (p) => new File(["x"], p.split(/[\\/]/).pop()!),
    freePath: async (d, n) => `${d}/${n}`,
    defaultDownloadDir: async () => "C:/Downloads",
    recentFiles: async () => [],
    ...over,
  };
}
const parse = (r: ToolResult) => JSON.parse(r.content[0].text);
const SLOW = 10_000; // MockProvider 업로드는 약 2초

describe("normalizeDir", () => {
  it("normalizes slashes", () => {
    expect(normalizeDir("피드백/2026-10/")).toBe("/피드백/2026-10");
    expect(normalizeDir("/피드백//2026-10")).toBe("/피드백/2026-10");
    expect(normalizeDir("")).toBe("/");
    expect(normalizeDir("/")).toBe("/");
  });
});

describe("resolveTarget", () => {
  it("splits missing Korean folders", async () => {
    expect(await resolveTarget(new MockProvider("t"), "docs", "/피드백/2026 10월")).toEqual({ targetDir: "/", relativePath: "피드백/2026 10월", existing: [] });
  });
  it("uses an existing folder as is", async () => {
    const r = await resolveTarget(new MockProvider("t"), "docs", "/회의록");
    expect(r.targetDir).toBe("/회의록");
    expect(r.relativePath).toBeUndefined();
    expect(r.existing).toHaveLength(2);
  });
});

describe("callTool", () => {
  it("list_libraries returns ids, sections and flags", async () => {
    const libs = parse(await callTool("list_libraries", {}, makeCtx()));
    expect(libs).toContainEqual({ id: "family", name: "집-공유", section: "나에게 공유됨", readOnly: true, encrypted: false });
  });

  it("list_dir lists entries", async () => {
    const r = parse(await callTool("list_dir", { library: "docs", path: "회의록" }, makeCtx()));
    expect(r.map((e: { name: string }) => e.name)).toEqual(["2026-10-20.md", "2026-10-13.md"]);
  });

  it(
    "upload_text creates folders and uploads",
    async () => {
      const ctx = makeCtx();
      const r = parse(await callTool("upload_text", { name: "계획.md", content: "# 안녕", library: "docs", dir: "피드백/2026-10/" }, ctx));
      expect(r.uploaded).toEqual([{ name: "계획.md", path: "/피드백/2026-10/계획.md" }]);
      expect((await ctx.storage.listDir("docs", "/피드백/2026-10")).map((e) => e.name)).toEqual(["계획.md"]);
    },
    SLOW,
  );

  it(
    "upload_base64 uploads the decoded bytes when sha256 matches",
    async () => {
      const ctx = makeCtx();
      // "hello"
      const args = { name: "보고서.docx", base64: "aGVs\nbG8=", sha256: "2CF24DBA5FB0A30E26E83B2AC5B9E29E1B161E5C1FA7425E73043362938B9824", library: "docs", dir: "/보고" };
      const r = parse(await callTool("upload_base64", args, ctx));
      expect(r.uploaded).toEqual([{ name: "보고서.docx", path: "/보고/보고서.docx" }]);
      expect((await ctx.storage.listDir("docs", "/보고")).map((e) => [e.name, e.size])).toEqual([["보고서.docx", 5]]);
    },
    SLOW,
  );

  it("upload_base64 refuses when sha256 does not match", async () => {
    const ctx = makeCtx();
    const r = await callTool("upload_base64", { name: "a.docx", base64: "aGVsbG8=", sha256: "00", library: "docs", dir: "/보고" }, ctx);
    expect(r.isError).toBe(true);
    expect(r.content[0].text).toContain("sha256");
    expect((await ctx.storage.listDir("docs", "/")).some((e) => e.name === "보고")).toBe(false);
  });

  it("upload_file stops entirely on any conflict", async () => {
    const ctx = makeCtx();
    const r = await callTool("upload_file", { local_paths: [String.raw`C:\x\README.md`, String.raw`C:\x\새 문서.md`], library: "docs", dir: "/" }, ctx);
    expect(r.isError).toBeFalsy();
    expect(parse(r)).toMatchObject({ uploaded: [], conflicts: ["README.md"] });
    expect((await ctx.storage.listDir("docs", "/")).some((e) => e.name === "새 문서.md")).toBe(false);
  });

  it(
    "upload_file overwrites when overwrite: true",
    async () => {
      const r = parse(await callTool("upload_file", { local_paths: [String.raw`C:\x\README.md`], library: "docs", dir: "/", overwrite: true }, makeCtx()));
      expect(r.uploaded).toEqual([{ name: "README.md", path: "/README.md" }]);
      expect(r.failed).toEqual([]);
    },
    SLOW,
  );

  it("rejects read-only and encrypted libraries", async () => {
    const ro = await callTool("upload_text", { name: "a.md", content: "a", library: "family", dir: "/" }, makeCtx());
    expect(ro.isError).toBe(true);
    expect(ro.content[0].text).toContain("읽기 전용");
    const enc = await callTool("download", { library: "vault", paths: ["/a"] }, makeCtx());
    expect(enc.isError).toBe(true);
    expect(enc.content[0].text).toContain("암호화");
  });

  it("download refuses folders and returns saved paths", async () => {
    const folder = await callTool("download", { library: "docs", paths: ["/회의록"] }, makeCtx());
    expect(folder.isError).toBe(true);
    expect(folder.content[0].text).toContain("파일만");
    const r = parse(await callTool("download", { library: "docs", paths: ["/README.md"] }, makeCtx({ freePath: async (d, n) => `${d}/(1) ${n}` })));
    expect(r).toEqual({ saved: ["C:/Downloads/(1) README.md"], failed: [] });
    const local = parse(await callTool("download", { library: "docs", paths: ["/README.md"], local_dir: "D:/work" }, makeCtx()));
    expect(local.saved).toEqual(["D:/work/README.md"]);
  });

  it("search maps library names and flags loading", async () => {
    const entries = [{ id: "1", name: "2026-10-20.md", type: "file" as const, size: 4000, mtime: 0, path: "/회의록/2026-10-20.md", libId: "docs" }];
    const r = parse(await callTool("search", { query: "2026-10" }, makeCtx({ searchIndex: () => ({ entries, loading: true }) })));
    expect(r.results).toEqual([{ library: "docs", libraryName: "문서", path: "/회의록/2026-10-20.md", type: "file", size: 4000 }]);
    expect(r.note).toBe("색인 중이라 결과가 일부일 수 있습니다");
  });

  it("recent_downloads reads the default download dir", async () => {
    const recentFiles = vi.fn(async () => [{ name: "a.docx", path: "C:/Downloads/a.docx", size: 1, mtime: 2 }]);
    const r = parse(await callTool("recent_downloads", {}, makeCtx({ recentFiles })));
    expect(recentFiles).toHaveBeenCalledWith("C:/Downloads", 10);
    expect(r).toEqual([{ name: "a.docx", path: "C:/Downloads/a.docx", size: 1, mtime: 2 }]);
  });
});
