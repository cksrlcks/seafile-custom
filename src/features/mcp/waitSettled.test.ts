import { describe, expect, it } from "vitest";
import { waitSettled } from "./waitSettled";

interface Item {
  id: string;
  status: "running" | "done" | "failed";
}

function source(initial: Item[]) {
  let items = initial;
  const listeners = new Set<(items: Item[]) => void>();
  return {
    subscribe: (fn: (items: Item[]) => void) => {
      listeners.add(fn);
      return () => void listeners.delete(fn);
    },
    getSnapshot: () => items,
    emit(next: Item[]) {
      items = next;
      for (const fn of listeners) fn(items);
    },
    listeners,
  };
}

const settled = (s: Item["status"]) => s !== "running";

describe("waitSettled", () => {
  it("resolves when every id is settled, in ids order", async () => {
    const src = source([
      { id: "1", status: "running" },
      { id: "2", status: "running" },
    ]);
    let result: Item[] | null = null;
    void waitSettled(src, ["1", "2"], settled).then((r) => (result = r));
    src.emit([
      { id: "1", status: "running" },
      { id: "2", status: "done" },
    ]);
    await Promise.resolve();
    expect(result).toBeNull();
    src.emit([
      { id: "2", status: "done" },
      { id: "1", status: "failed" },
    ]);
    await Promise.resolve();
    expect(result).toEqual([
      { id: "1", status: "failed" },
      { id: "2", status: "done" },
    ]);
  });

  it("resolves immediately if already settled", async () => {
    const src = source([{ id: "1", status: "done" }]);
    await expect(waitSettled(src, ["1"], settled)).resolves.toEqual([{ id: "1", status: "done" }]);
  });

  it("unsubscribes after resolving", async () => {
    const src = source([{ id: "1", status: "running" }]);
    const p = waitSettled(src, ["1"], settled);
    src.emit([{ id: "1", status: "done" }]);
    await p;
    expect(src.listeners.size).toBe(0);
  });
});
