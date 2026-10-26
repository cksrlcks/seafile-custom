import { describe, expect, it } from "vitest";
import type { Entry } from "@/storage/StorageProvider";
import { planUploads, toUploadTasks } from "./planUploads";

function fakeFile(name: string, path?: string): File {
  const f = { name, size: 1 } as unknown as File & { path?: string };
  if (path !== undefined) f.path = path;
  return f;
}

const entry = (name: string): Entry => ({ id: name, name, type: "file", size: 1, mtime: 0, path: "/" + name });

describe("toUploadTasks", () => {
  it("derives relativePath from file.path", () => {
    const tasks = toUploadTasks([fakeFile("c.txt", "/a/b/c.txt"), fakeFile("c.txt", "./a/b/c.txt"), fakeFile("c.txt", "c.txt")], "/x");
    expect(tasks.map((t) => t.relativePath)).toEqual(["a/b", "a/b", undefined]);
    expect(tasks.every((t) => t.targetDir === "/x")).toBe(true);
  });

  it("treats missing path as top-level", () => {
    expect(toUploadTasks([fakeFile("c.txt")], "/x")[0].relativePath).toBeUndefined();
  });
});

describe("planUploads", () => {
  it("flags same-name top-level files as conflicts", () => {
    const tasks = toUploadTasks([fakeFile("a.txt", "a.txt"), fakeFile("b.txt", "b.txt")], "/");
    const { conflicts, fresh } = planUploads(tasks, [entry("a.txt")]);
    expect(conflicts.map((t) => t.file.name)).toEqual(["a.txt"]);
    expect(fresh.map((t) => t.file.name)).toEqual(["b.txt"]);
  });

  it("nested files never conflict", () => {
    const tasks = toUploadTasks([fakeFile("a.txt", "/d/a.txt")], "/");
    const { conflicts, fresh } = planUploads(tasks, [entry("a.txt")]);
    expect(conflicts).toEqual([]);
    expect(fresh).toHaveLength(1);
  });
});
