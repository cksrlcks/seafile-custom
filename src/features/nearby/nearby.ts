import { useSyncExternalStore } from "react";
import { logError } from "@/lib/errorLog";
import type { Entry } from "@/storage/StorageProvider";

/** 근처로 보내기: 같은 네트워크·같은 서버의 U-Drive끼리 파일을 직접 주고받는다. 찾기·전송은 Rust(nearby.rs) */

export interface Person {
  name: string;
  email: string;
  device: string;
}
export interface Peer extends Person {
  /** mDNS 이름. nearby_send에 넘긴다 */
  id: string;
}
export interface FileMeta {
  name: string;
  size: number;
}
/** 누가 보내려 한다: 받을지 묻는 중 */
export interface Offer {
  id: string;
  from: Person;
  files: FileMeta[];
  total: number;
}
/** preparing(드라이브에서 임시로 받는 중, 화면에서만) · asking(상대 답 기다림) · active · done · declined · failed · canceled */
export type TransferStatus = "preparing" | "asking" | "active" | "done" | "declined" | "failed" | "canceled";
export interface Transfer {
  id: string;
  send: boolean;
  peer: string;
  /** 첫 파일 이름. 여러 개면 count로 "외 N개" */
  name: string;
  count: number;
  done: number;
  total: number;
  status: TransferStatus;
  error?: string | null;
  /** 받기 완료: 받은 첫 파일 경로 */
  path?: string | null;
}

export interface NearbyState {
  peers: Peer[];
  offers: Offer[];
  transfers: Transfer[];
  /** 찾기를 시작하지 못했을 때 사유 */
  error: string | null;
}

export const finished = (t: Transfer) => t.status === "done" || t.status === "declined" || t.status === "failed" || t.status === "canceled";

/** 같은 id면 바꾸고 없으면 뒤에 붙인다 */
export function upsert(list: Transfer[], t: Transfer): Transfer[] {
  const i = list.findIndex((x) => x.id === t.id);
  if (i < 0) return [...list, t];
  const next = list.slice();
  next[i] = t;
  return next;
}

export class NearbyStore {
  private state: NearbyState = { peers: [], offers: [], transfers: [], error: null };
  private listeners = new Set<() => void>();

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => void this.listeners.delete(l);
  };
  getSnapshot = () => this.state;

  private set(patch: Partial<NearbyState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  setPeers = (peers: Peer[]) => this.set({ peers });
  setError = (error: string | null) => this.set({ error });
  addOffer = (o: Offer) => this.set({ offers: [...this.state.offers.filter((x) => x.id !== o.id), o] });
  closeOffer = (id: string) => this.set({ offers: this.state.offers.filter((x) => x.id !== id) });
  update = (t: Transfer) => this.set({ transfers: upsert(this.state.transfers, t) });
  remove = (id: string) => this.set({ transfers: this.state.transfers.filter((x) => x.id !== id) });
  clearFinished = () => this.set({ transfers: this.state.transfers.filter((t) => !finished(t)) });
}

export const nearby = new NearbyStore();

export function useNearby(): NearbyState {
  return useSyncExternalStore(nearby.subscribe, nearby.getSnapshot);
}

const invoke = async <T>(cmd: string, args?: Record<string, unknown>) => (await import("@tauri-apps/api/core")).invoke<T>(cmd, args);

/** Rust 이벤트를 저장소로. 앱에서 한 번(NearbyRoot) */
export async function listenNearby(): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  const offs = await Promise.all([
    listen<Peer[]>("nearby-peers", (e) => nearby.setPeers(e.payload)),
    listen<Offer>("nearby-offer", (e) => nearby.addOffer(e.payload)),
    listen<string>("nearby-offer-closed", (e) => nearby.closeOffer(e.payload)),
    listen<Transfer>("nearby-transfer", (e) => nearby.update(e.payload)),
  ]);
  return () => offs.forEach((f) => f());
}

export async function startNearby(me: { name: string; email: string; server: string }) {
  try {
    await invoke("nearby_start", me);
    nearby.setError(null);
    nearby.setPeers(await invoke<Peer[]>("nearby_peers"));
  } catch (e) {
    logError("nearby", e);
    nearby.setError(String(e));
  }
}

export const stopNearby = () => invoke("nearby_stop").catch((e) => logError("nearby", e));
export const answerOffer = (id: string, accept: boolean) => invoke("nearby_answer", { id, accept }).catch((e) => logError("nearby", e));
export const cancelTransfer = (id: string) => invoke("nearby_cancel", { id }).catch((e) => logError("nearby", e));

const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;
let seq = 0;

/** 보내기를 시작하지 못하면 패널에 실패 줄을 남긴다(Rust가 id를 주기 전 단계) */
function failLocal(key: string, peer: Peer, files: FileMeta[], e: unknown) {
  logError("nearby", e);
  nearby.update({ id: key, send: true, peer: peer.name, name: files[0]?.name ?? "", count: files.length, done: 0, total: files.reduce((a, f) => a + f.size, 0), status: "failed", error: String(e) });
}

/** 내 PC의 파일을 보낸다 */
export async function sendLocal(peer: Peer, paths: string[]) {
  const files = paths.map((p) => ({ path: p, name: baseName(p) }));
  try {
    await invoke<string>("nearby_send", { peer: peer.id, files, temp: false });
  } catch (e) {
    failLocal(`l${++seq}`, peer, files.map((f) => ({ name: f.name, size: 0 })), e);
  }
}

/**
 * 드라이브 파일을 보낸다: 앱 캐시 폴더에 임시로 받은 뒤 보내고, Rust가 보낸 다음 지운다.
 * 받는 동안은 화면에서만 preparing 줄을 보여 준다.
 */
export async function sendDrive(peer: Peer, entries: Entry[], getUrl: (e: Entry) => Promise<string>) {
  const files = entries.filter((e) => e.type === "file");
  if (!files.length) return;
  const key = `p${++seq}`;
  const total = files.reduce((a, f) => a + f.size, 0);
  const row: Transfer = { id: key, send: true, peer: peer.name, name: files[0].name, count: files.length, done: 0, total, status: "preparing" };
  nearby.update(row);
  try {
    const { appCacheDir, join } = await import("@tauri-apps/api/path");
    const { download } = await import("@tauri-apps/plugin-upload");
    const dir = await join(await appCacheDir(), "nearby", `${key}-${Date.now()}`);
    const paths: string[] = [];
    let before = 0;
    for (const f of files) {
      // free_path가 폴더도 만든다
      const path = await invoke<string>("free_path", { dir, name: f.name });
      let last = 0;
      await download(await getUrl(f), path, (p) => {
        const now = performance.now();
        if (now - last < 100) return;
        last = now;
        nearby.update({ ...row, done: before + p.progressTotal });
      });
      before += f.size;
      paths.push(path);
    }
    await invoke<string>("nearby_send", { peer: peer.id, files: paths.map((path, i) => ({ path, name: files[i].name })), temp: true });
    nearby.remove(key);
  } catch (e) {
    failLocal(key, peer, files, e);
  }
}
