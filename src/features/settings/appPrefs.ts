import { useSyncExternalStore } from "react";
import { isTauri } from "@/features/shell/platform";

export type Theme = "system" | "light" | "dark";
export type Font = "system" | "pretendard" | "geist";

export interface AppPrefs {
  theme: Theme;
  font: Font;
  /** 화면 배율(1 = 100%). 글자 크기가 px로 고정돼 있어 웹뷰 배율로 키운다 */
  zoom: number;
  /** 창 닫기 = 트레이로 숨기기. 끄면 앱 종료 */
  closeToTray: boolean;
  /** 다운로드 폴더. null이면 받을 때마다 묻는다 */
  downloadDir: string | null;
  /** 근처로 보내기: 같은 네트워크·같은 서버의 U-Drive에 나를 보이고 서로 파일을 주고받는다 */
  nearbyVisible: boolean;
}

const KEY = "seadrive.prefs";
const DEFAULTS: AppPrefs = { theme: "system", font: "system", zoom: 1, closeToTray: true, downloadDir: null, nearbyVisible: true };
const listeners = new Set<() => void>();

function load(): AppPrefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<AppPrefs>) };
  } catch {
    return DEFAULTS;
  }
}

let current = load();

export const getPrefs = () => current;

export function setPrefs(patch: Partial<AppPrefs>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // 저장 못 해도 이번 실행 동안은 유지된다
  }
  apply(current);
  listeners.forEach((l) => l());
}

export function useAppPrefs(): AppPrefs {
  return useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, getPrefs);
}

const darkQuery = typeof matchMedia === "undefined" ? null : matchMedia("(prefers-color-scheme: dark)");

/** 화면(테마·글꼴·배율)과 Rust 쪽(창 닫기·트레이의 다운로드 폴더)에 반영 */
function applyLook(p: AppPrefs) {
  const root = document.documentElement;
  root.classList.toggle("dark", p.theme === "dark" || (p.theme === "system" && !!darkQuery?.matches));
  root.dataset.font = p.font;
}

function apply(p: AppPrefs) {
  applyLook(p);
  if (!isTauri()) return;
  void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) => getCurrentWebview().setZoom(p.zoom)).catch(() => {});
  // 맥 신호등·타이틀바 색을 앱 테마에 맞춘다(system이면 OS를 따름)
  void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().setTheme(p.theme === "system" ? null : p.theme)).catch(() => {});
  void import("@tauri-apps/api/core").then(({ invoke }) => invoke("set_prefs", { closeToTray: p.closeToTray, downloadDir: p.downloadDir })).catch(() => {});
}

/** 근처로 보내기 팝업 창: 테마·글꼴만 맞춘다(배율·Rust 설정은 메인 창 몫) */
export function initPopupPrefs() {
  applyLook(current);
  darkQuery?.addEventListener("change", () => current.theme === "system" && applyLook(current));
}

/** 앱 시작 시 한 번. 시스템 테마가 바뀌면 따라간다 */
export function initPrefs() {
  apply(current);
  darkQuery?.addEventListener("change", () => current.theme === "system" && apply(current));
}
