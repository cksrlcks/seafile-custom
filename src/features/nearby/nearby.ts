import { useSyncExternalStore } from "react";
import { waitSettled } from "@/features/mcp/waitSettled";
import type { AppPrefs, DriveFolder } from "@/features/settings/appPrefs";
import type { UploadQueue } from "@/features/upload/uploadQueue";
import { logError } from "@/lib/errorLog";
import { splitPath } from "@/storage/path";
import type { Entry, StorageProvider } from "@/storage/StorageProvider";

/** 바로 보내기: 같은 네트워크·같은 서버의 U-Drive끼리 파일을 직접 주고받는다. 찾기·전송은 Rust(nearby.rs) */

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
  /** 받기 완료: PC에 받은 첫 파일 경로 */
  path?: string | null;
  /** 드라이브로 받기 완료: 드라이브에 올릴 임시 파일 */
  upload?: string[];
  /** 드라이브로 받기: 올릴 폴더(팝업에서 답할 때 고른 곳) */
  target?: DriveFolder | null;
  /** 끝났지만 알려 줄 것 */
  note?: string | null;
  /** 드라이브로 받기: 받은 뒤 올리는 단계(화면에서만) */
  stage?: "uploading" | "uploaded" | "upload-failed";
}

export interface NearbyState {
  peers: Peer[];
  offers: Offer[];
  transfers: Transfer[];
  /** 찾기를 시작하지 못했을 때 사유 */
  error: string | null;
  /** 회사 네트워크(서버에 닿는 곳)가 아니라 멈춰 둠 */
  offNetwork: boolean;
}

/** 끝난 전송. 드라이브로 받기는 다 올릴 때까지 끝나지 않은 것으로 본다 */
export const finished = (t: Transfer) => (t.status === "done" && t.stage !== "uploading") || t.status === "declined" || t.status === "failed" || t.status === "canceled";

/** 같은 id면 바꾸고 없으면 뒤에 붙인다 */
export function upsert(list: Transfer[], t: Transfer): Transfer[] {
  const i = list.findIndex((x) => x.id === t.id);
  if (i < 0) return [...list, t];
  const next = list.slice();
  next[i] = t;
  return next;
}

export class NearbyStore {
  private state: NearbyState = { peers: [], offers: [], transfers: [], error: null, offNetwork: false };
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
  setOffNetwork = (offNetwork: boolean) => this.set({ offNetwork });
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

/**
 * 회사 네트워크인지: 서버에 인증서 오류 없이 닿으면 true. 서버 이름은 회사 밖에서도 사설 IP로 풀려서 밖에서는 닿지 않고,
 * 다른 PC가 그 IP를 쓰더라도 서버 인증서를 낼 수 없다. no-cors라 CORS 설정과 상관없이 연결(TLS)이 되는지만 본다
 */
export async function serverReachable(server: string, timeoutMs = 5000, f: typeof fetch = fetch): Promise<boolean> {
  try {
    await f(`${server}/api2/ping/`, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    return true;
  } catch {
    return false;
  }
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
/** target이 있으면 드라이브의 그 폴더로 받는다. pcDir은 PC에 받을 폴더(드라이브로 받을 때 큰 파일도 여기). null이면 다운로드 폴더 */
export const answerOffer = (id: string, accept: boolean, target: DriveFolder | null = null, pcDir: string | null = null) =>
  invoke("nearby_answer", { id, accept, target, pcDir }).catch((e) => logError("nearby", e));
export const openSendSettings = () => invoke("nearby_open_settings").catch((e) => logError("nearby", e));
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

/** taken에 없는 이름. 있으면 "이름 (1).확장자" 식으로 번호를 붙인다(Rust create_free와 같은 규칙) */
export function freeName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let n = 1; ; n++) {
    const next = `${stem} (${n})${ext}`;
    if (!taken.has(next)) return next;
  }
}

/** 드라이브 폴더를 업로드 위치로: 저장소 루트 + 상대 경로(없는 폴더는 서버가 만든다) */
export function uploadSpot(path: string): { targetDir: string; relativePath?: string } {
  const segs = splitPath(path);
  return segs.length ? { targetDir: "/", relativePath: segs.join("/") } : { targetDir: "/" };
}

const uploading = new Set<string>();

/**
 * 드라이브로 받은 파일을 target 폴더에 올린다. 같은 이름이 있으면 덮어쓰지 않고 번호를 붙인다.
 * 다 끝나면(실패해도) Rust 임시 폴더를 지운다. 메인 창의 NearbyRoot가 받기 완료 이벤트마다 부른다.
 */
export async function uploadReceived(t: Transfer, storage: StorageProvider, queue: UploadQueue, readLocalFile: (path: string) => Promise<File>) {
  if (!t.target || !t.upload?.length || uploading.has(t.id)) return;
  uploading.add(t.id);
  const { libId, path } = t.target;
  nearby.update({ ...t, stage: "uploading" });
  try {
    const existing = await storage.listDir(libId, path).catch(() => []); // 폴더가 아직 없으면 빈 목록
    const taken = new Set(existing.map((e) => e.name));
    const files: File[] = [];
    for (const p of t.upload) {
      const f = await readLocalFile(p);
      const name = freeName(f.name, taken);
      taken.add(name);
      files.push(name === f.name ? f : new File([f], name, { type: f.type }));
    }
    const ids = queue.add(libId, files.map((file) => ({ file, ...uploadSpot(path) })));
    const done = await waitSettled(queue, ids, (s) => s === "done" || s === "failed" || s === "cancelled");
    nearby.update({ ...t, stage: done.every((i) => i.status === "done") ? "uploaded" : "upload-failed" });
  } catch (e) {
    logError("nearby", e);
    nearby.update({ ...t, stage: "upload-failed", error: String(e) });
  } finally {
    uploading.delete(t.id);
    await invoke("nearby_cleanup", { id: t.id }).catch((e) => logError("nearby", e));
  }
}

/** 받을 위치 한 줄(팝업·설정) */
export function receiveLabel(to: "pc" | "drive", p: Pick<AppPrefs, "downloadDir" | "receivePcDir" | "receiveDrive">): string {
  if (to === "pc") return p.receivePcDir ?? p.downloadDir ?? "다운로드 폴더";
  const d = p.receiveDrive;
  return d ? `${d.libName}${d.path === "/" ? "" : d.path}` : "내 저장소/받은 파일";
}
