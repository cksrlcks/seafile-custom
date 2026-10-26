import { describe, expect, it, vi } from "vitest";
import { DownloadQueue, type Saver } from "./downloadQueue";

type Call = { url: string; path: string; onProgress(received: number, total: number): void; resolve(): void; reject(e: Error): void };

function fakeSaver() {
  const calls: Call[] = [];
  const save: Saver = vi.fn(
    (url: string, path: string, onProgress: (r: number, t: number) => void) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ url, path, onProgress, resolve, reject });
      }),
  );
  return { save, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("DownloadQueue", () => {
  it("downloads to the chosen path and tracks progress", async () => {
    const { save, calls } = fakeSaver();
    const q = new DownloadQueue(save);
    q.add([{ name: "a.bin", size: 100, url: () => Promise.resolve("https://x/a"), path: "C:/D/a.bin" }]);
    await tick();
    expect(calls[0]).toMatchObject({ url: "https://x/a", path: "C:/D/a.bin" });
    calls[0].onProgress(40, 100);
    expect(q.getSnapshot()[0]).toMatchObject({ status: "downloading", received: 40, total: 100 });
    calls[0].resolve();
    await tick();
    expect(q.getSnapshot()[0]).toMatchObject({ status: "done", received: 100 });
  });

  it("falls back to the entry size when the server sends no length", async () => {
    const { save, calls } = fakeSaver();
    const q = new DownloadQueue(save);
    q.add([{ name: "a.bin", size: 500, url: () => Promise.resolve("u"), path: "p" }]);
    await tick();
    calls[0].onProgress(10, 0);
    expect(q.getSnapshot()[0].total).toBe(500);
  });

  it("runs at most 2 at a time", async () => {
    const { save, calls } = fakeSaver();
    const q = new DownloadQueue(save);
    q.add(["a", "b", "c"].map((n) => ({ name: n, size: 1, url: () => Promise.resolve(n), path: n })));
    await tick();
    expect(calls).toHaveLength(2);
    calls[0].resolve();
    await tick();
    await tick();
    expect(calls).toHaveLength(3);
  });

  it("marks failures and can retry", async () => {
    const { save, calls } = fakeSaver();
    const q = new DownloadQueue(save);
    q.add([{ name: "a", size: 1, url: () => Promise.resolve("u"), path: "p" }]);
    await tick();
    calls[0].reject(new Error("disk full"));
    await tick();
    expect(q.getSnapshot()[0]).toMatchObject({ status: "failed", error: "disk full" });
    q.retry(q.getSnapshot()[0].id);
    await tick();
    await tick();
    expect(calls).toHaveLength(2);
  });
});
