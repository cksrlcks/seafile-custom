import { describe, expect, it } from "vitest";
import { finished, NearbyStore, upsert, type Transfer } from "./nearby";

const t = (id: string, status: Transfer["status"], done = 0): Transfer => ({ id, send: true, peer: "가", name: "a.txt", count: 1, done, total: 10, status });

describe("upsert", () => {
  it("같은 id는 제자리에서 바꾸고 새 id는 뒤에 붙인다", () => {
    const list = [t("s1", "asking"), t("s2", "active")];
    expect(upsert(list, t("s1", "active", 5)).map((x) => [x.id, x.status, x.done])).toEqual([
      ["s1", "active", 5],
      ["s2", "active", 0],
    ]);
    expect(upsert(list, t("r1", "active")).map((x) => x.id)).toEqual(["s1", "s2", "r1"]);
  });
});

describe("NearbyStore", () => {
  it("끝난 전송만 지운다", () => {
    const s = new NearbyStore();
    for (const x of [t("a", "done"), t("b", "active"), t("c", "declined"), t("d", "preparing"), t("e", "failed"), t("f", "canceled"), t("g", "asking")]) s.update(x);
    s.clearFinished();
    expect(s.getSnapshot().transfers.map((x) => x.id)).toEqual(["b", "d", "g"]);
    expect(s.getSnapshot().transfers.some(finished)).toBe(false);
  });

  it("받기 요청은 들어온 순서대로 쌓이고 닫으면 빠진다", () => {
    const s = new NearbyStore();
    const from = { name: "가", email: "a@x", device: "PC" };
    s.addOffer({ id: "r1", from, files: [], total: 0 });
    s.addOffer({ id: "r2", from, files: [], total: 0 });
    s.closeOffer("r1");
    expect(s.getSnapshot().offers.map((o) => o.id)).toEqual(["r2"]);
  });

  it("바뀔 때마다 구독자에게 알리고 스냅샷은 새 객체다", () => {
    const s = new NearbyStore();
    let n = 0;
    const off = s.subscribe(() => n++);
    const before = s.getSnapshot();
    s.setPeers([{ id: "x", name: "가", email: "a@x", device: "PC" }]);
    expect(n).toBe(1);
    expect(s.getSnapshot()).not.toBe(before);
    off();
    s.setPeers([]);
    expect(n).toBe(1);
  });
});
