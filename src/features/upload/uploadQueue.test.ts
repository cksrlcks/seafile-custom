import { describe, expect, it, vi } from "vitest";
import type { StorageProvider, UploadTask } from "@/storage/StorageProvider";
import { UploadQueue } from "./uploadQueue";

type Deferred = { resolve(): void; reject(e: Error): void; onProgress(sent: number, total: number): void; signal?: AbortSignal };

function fakeProvider() {
  const calls: Deferred[] = [];
  const upload = vi.fn((_lib: string, _t: UploadTask, onProgress: Deferred["onProgress"], signal?: AbortSignal) => {
    return new Promise<void>((resolve, reject) => {
      calls.push({ resolve, reject, onProgress, signal });
    });
  });
  return { provider: { upload } as unknown as StorageProvider, calls, upload };
}

const task = (name: string): UploadTask => ({ file: { name, size: 10 } as File, targetDir: "/d" });
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("UploadQueue", () => {
  it("runs at most 3 concurrently", async () => {
    const { provider, calls, upload } = fakeProvider();
    const q = new UploadQueue(provider);
    q.add("lib", ["a", "b", "c", "d", "e"].map(task));
    await tick();
    expect(upload).toHaveBeenCalledTimes(3);
    calls[0].resolve();
    await tick();
    expect(upload).toHaveBeenCalledTimes(4);
  });

  it("retries then fails", async () => {
    const { provider, calls } = fakeProvider();
    const q = new UploadQueue(provider, { retries: 2 });
    q.add("lib", [task("a")]);
    for (let i = 0; i < 3; i++) {
      await tick();
      calls[i].reject(new Error("boom"));
    }
    await tick();
    const item = q.getSnapshot()[0];
    expect(item.status).toBe("failed");
    expect(item.attempts).toBe(3);
    expect(item.error).toBe("boom");
  });

  it("cancel aborts signal and does not retry", async () => {
    const { provider, calls, upload } = fakeProvider();
    const q = new UploadQueue(provider);
    q.add("lib", [task("a")]);
    await tick();
    q.cancel(q.getSnapshot()[0].id);
    expect(calls[0].signal?.aborted).toBe(true);
    calls[0].reject(new DOMException("aborted", "AbortError"));
    await tick();
    expect(q.getSnapshot()[0].status).toBe("cancelled");
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it("reports progress", async () => {
    const { provider, calls } = fakeProvider();
    const q = new UploadQueue(provider);
    q.add("lib", [task("a")]);
    await tick();
    calls[0].onProgress(5, 10);
    expect(q.getSnapshot()[0].sent).toBe(5);
    expect(q.getSnapshot()[0].total).toBe(10);
  });

  it("calls onAllDone with target dirs", async () => {
    const { provider, calls } = fakeProvider();
    const q = new UploadQueue(provider);
    const done = vi.fn();
    q.onAllDone = done;
    q.add("lib", [task("a"), { ...task("b"), relativePath: "sub" }]);
    await tick();
    calls[0].resolve();
    calls[1].resolve();
    await tick();
    expect(done).toHaveBeenCalledTimes(1);
    expect(done.mock.calls[0][0]).toBe("lib");
    expect([...done.mock.calls[0][1]].sort()).toEqual(["/d", "/d/sub"]);
  });

  it("retry re-queues a failed item", async () => {
    const { provider, calls, upload } = fakeProvider();
    const q = new UploadQueue(provider, { retries: 0 });
    q.add("lib", [task("a")]);
    await tick();
    calls[0].reject(new Error("x"));
    await tick();
    expect(q.getSnapshot()[0].status).toBe("failed");
    q.retry(q.getSnapshot()[0].id);
    await tick();
    expect(upload).toHaveBeenCalledTimes(2);
    expect(q.getSnapshot()[0].status).toBe("uploading");
  });

  it("notifies subscribers on change", async () => {
    const { provider } = fakeProvider();
    const q = new UploadQueue(provider);
    const fn = vi.fn();
    q.subscribe(fn);
    q.add("lib", [task("a")]);
    expect(fn).toHaveBeenCalled();
  });
});
