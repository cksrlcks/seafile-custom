import { useSyncExternalStore } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import { isTauri } from "./platform";

export type UpdaterState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "none" }
  | { kind: "available"; version: string; notes?: string }
  | { kind: "downloading"; percent: number | null }
  | { kind: "error"; message: string };

let state: UpdaterState = { kind: "idle" };
let pending: Update | null = null;
const listeners = new Set<() => void>();
const set = (s: UpdaterState) => {
  state = s;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** 릴리스 노트(CHANGELOG 섹션)의 첫 줄 요약. 알림은 한 줄이라 마크다운 기호는 뺀다 */
export const noteSummary = (body?: string) =>
  body
    ?.split("\n")
    .map((l) => l.replace(/[#*`]/g, "").trim())
    .find(Boolean);

/** 릴리스의 latest.json을 확인한다. 자동 확인(manual=false)은 실패·최신이어도 조용히 넘어간다 */
export async function checkForUpdate(manual = false) {
  if (!isTauri()) {
    if (manual) set({ kind: "error", message: "설치된 앱에서만 업데이트를 확인할 수 있습니다" });
    return;
  }
  if (state.kind === "checking" || state.kind === "downloading") return;
  set({ kind: "checking" });
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const u = await check();
    pending = u;
    if (u) set({ kind: "available", version: u.version, notes: noteSummary(u.body) });
    else set(manual ? { kind: "none" } : { kind: "idle" });
  } catch (e) {
    set(manual ? { kind: "error", message: `업데이트를 확인하지 못했습니다 (${message(e)})` } : { kind: "idle" });
  }
}

/** 받아서 설치하고 앱을 다시 띄운다. Windows는 설치 프로그램이 앱을 닫고 진행한다 */
export async function installUpdate() {
  if (!pending) return;
  let total = 0;
  let got = 0;
  set({ kind: "downloading", percent: null });
  try {
    await pending.downloadAndInstall((ev) => {
      if (ev.event === "Started") total = ev.data.contentLength ?? 0;
      else if (ev.event === "Progress") {
        got += ev.data.chunkLength;
        set({ kind: "downloading", percent: total ? Math.min(100, (got / total) * 100) : null });
      }
    });
    const { relaunch } = await import("@tauri-apps/plugin-process");
    await relaunch();
  } catch (e) {
    set({ kind: "error", message: `업데이트하지 못했습니다 (${message(e)})` });
  }
}

export const dismissUpdate = () => set({ kind: "idle" });

export function useUpdater(): UpdaterState {
  return useSyncExternalStore(subscribe, () => state);
}
