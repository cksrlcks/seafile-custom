import { useSyncExternalStore } from "react";

const KEY = "seadrive.thumbnails";
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

function write(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // 저장 못 해도 이번 세션 동안은 아래 알림으로 반영된다
  }
  listeners.forEach((l) => l());
}

/** 이미지 썸네일(아이콘 보기·세부 정보 창) on/off. 기본 켬, localStorage에 기억. 설정 창과 그리드가 같이 본다 */
export function useThumbnailPref(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore((l) => {
    listeners.add(l);
    return () => listeners.delete(l);
  }, read);
  return [on, write];
}
