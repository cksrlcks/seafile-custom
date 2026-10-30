import { describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { UploadQueue } from "@/features/upload/uploadQueue";
import { MockProvider } from "@/storage/mock/MockProvider";
import { finished, freeName, nearby, NearbyStore, receiveLabel, uploadReceived, uploadSpot, upsert, type Transfer } from "./nearby";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async () => undefined) }));

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

describe("freeName", () => {
  it("겹치면 확장자 앞에 번호를 붙인다(Rust create_free와 같은 규칙)", () => {
    expect(freeName("a.pdf", new Set())).toBe("a.pdf");
    expect(freeName("a.pdf", new Set(["a.pdf", "a (1).pdf"]))).toBe("a (2).pdf");
    expect(freeName("README", new Set(["README"]))).toBe("README (1)");
    expect(freeName(".env", new Set([".env"]))).toBe(".env (1)");
    expect(freeName("묶음.tar.gz", new Set(["묶음.tar.gz"]))).toBe("묶음.tar (1).gz");
  });
});

describe("uploadSpot", () => {
  it("폴더를 저장소 루트 + 상대 경로로 나눠 없는 폴더를 서버가 만들게 한다", () => {
    expect(uploadSpot("/받은 파일")).toEqual({ targetDir: "/", relativePath: "받은 파일" });
    expect(uploadSpot("/a/b")).toEqual({ targetDir: "/", relativePath: "a/b" });
    expect(uploadSpot("/")).toEqual({ targetDir: "/" });
  });
});

describe("드라이브로 받기", () => {
  it("올리는 중에는 끝난 것으로 보지 않는다", () => {
    expect(finished({ ...t("r1", "done"), stage: "uploading" })).toBe(false);
    expect(finished({ ...t("r1", "done"), stage: "uploaded" })).toBe(true);
  });

  it("받을 위치 한 줄", () => {
    expect(receiveLabel("pc", { downloadDir: null, receiveDrive: null })).toBe("다운로드 폴더");
    expect(receiveLabel("pc", { downloadDir: "/Users/me/받기", receiveDrive: null })).toBe("/Users/me/받기");
    expect(receiveLabel("drive", { downloadDir: null, receiveDrive: { libId: "d", libName: "문서", path: "/받은 파일" } })).toBe("문서/받은 파일");
    expect(receiveLabel("drive", { downloadDir: null, receiveDrive: { libId: "d", libName: "문서", path: "/" } })).toBe("문서");
  });

  it("같은 이름이 있으면 덮어쓰지 않고 번호를 붙여 올린 뒤 임시 파일을 지운다", async () => {
    const storage = new MockProvider("t");
    const queue = new UploadQueue(storage);
    const existing = (await storage.listDir("docs", "/")).find((e) => e.type === "file")!;
    const received: Transfer = { ...t("r7", "done"), send: false, upload: ["/tmp/in/x", "/tmp/in/y"], target: { libId: "docs", libName: "문서", path: "/" } };
    const read = async (p: string) => new File(["새 내용"], p.endsWith("x") ? existing.name : "새 파일.txt");
    nearby.update(received);

    await uploadReceived(received, storage, queue, read);

    const after = await storage.listDir("docs", "/");
    const dot = existing.name.lastIndexOf(".");
    const renamed = dot > 0 ? `${existing.name.slice(0, dot)} (1)${existing.name.slice(dot)}` : `${existing.name} (1)`;
    expect(after.find((e) => e.name === existing.name)?.size).toBe(existing.size);
    expect(after.some((e) => e.name === renamed)).toBe(true);
    expect(after.some((e) => e.name === "새 파일.txt")).toBe(true);
    expect(nearby.getSnapshot().transfers.find((x) => x.id === "r7")?.stage).toBe("uploaded");
    expect(invoke).toHaveBeenCalledWith("nearby_cleanup", { id: "r7" });
  }, 10_000);
});
