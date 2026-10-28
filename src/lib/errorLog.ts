import pkg from "../../package.json";
import { isTauri } from "@/features/shell/platform";

/** 로그: 앱 로그 폴더의 drive.log에 한 줄씩. 사용자가 설정에서 폴더를 열어 파일을 담당자에게 보낸다 */

// ponytail: 40자 이상 hex(인증 토큰)·UUID(공유/업로드 링크)만 가린다. 다른 비밀이 메시지에 섞이면 패턴 추가
const redact = (s: string) => s.replace(/[0-9a-f]{40,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<가림>");

export function formatEntry(source: string, e: unknown, at = new Date()): string {
  const err = e instanceof Error ? e : null;
  const msg = err ? `${err.name}: ${err.message}` : String(e);
  const stack = err?.stack ? `\n${err.stack.replace(/^/gm, "    ")}` : "";
  return redact(`[${at.toISOString()}] (${source}) ${msg}${stack}`);
}

function append(line: string) {
  if (!isTauri()) return console.warn(line);
  void import("@tauri-apps/api/core").then(({ invoke }) => invoke("append_log", { line })).catch(() => {});
}

export const logError = (source: string, e: unknown) => append(formatEntry(source, e));

export function openLogDir() {
  return import("@tauri-apps/api/core").then(({ invoke }) => invoke("open_log_dir"));
}

/** 처리되지 않은 오류를 전부 남긴다. main.tsx에서 한 번 */
export function installErrorLog() {
  append(`[${new Date().toISOString()}] (start) Drive v${pkg.version} · ${navigator.userAgent}`);
  window.addEventListener("error", (e) => logError("window", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => logError("promise", e.reason));
}
