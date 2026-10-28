import { useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent } from "react";
import type { Entry } from "@/storage/StorageProvider";

const THRESHOLD = 4;

export interface DragState {
  x: number;
  y: number;
  count: number;
  /** 지금 놓으면 옮겨 갈 폴더 경로 */
  over: string | null;
}

/**
 * 항목의 [data-drag] 부분(아이콘·이름)을 끌어 같은 목록의 폴더 위에 놓으면 onDrop — 탐색기처럼 나머지 빈 곳에서는 드래그 선택.
 * 끄는 항목이 선택돼 있으면 선택 전체, 아니면 그 항목만 옮긴다. 자기 자신 위에는 못 놓고, Esc로 취소한다.
 * 항목이 아닌 놓을 곳(상위 폴더 ".." 줄)은 [data-drop="경로"]로 표시한다.
 * onPointerDown이 true를 돌려주면 이 훅이 맡았으니 드래그 선택을 시작하지 않는다.
 */
export function useDragMove(entries: Entry[], selected: Set<string>, onStart: (paths: Set<string>) => void, onDrop: (items: Entry[], dstDir: string) => void, disabled: boolean) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragged = useRef(false);

  const onPointerDown = (e: RPointerEvent): boolean => {
    if (disabled || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey) return false;
    const target = e.target as Element;
    if (target.closest("input")) return false;
    const path = target.closest("[data-drag]")?.closest<HTMLElement>("[data-path]")?.dataset.path;
    const entry = entries.find((x) => x.path === path);
    if (!entry) return false;

    const el = e.currentTarget as Element;
    const items = selected.has(entry.path) ? entries.filter((x) => selected.has(x.path)) : [entry];
    const moving = new Set(items.map((x) => x.path));
    const { clientX: sx, clientY: sy, pointerId } = e;
    let active = false;
    let over: string | null = null;

    const folderAt = (ev: PointerEvent) => {
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const drop = hit?.closest<HTMLElement>("[data-drop]")?.dataset.drop;
      if (drop) return drop;
      const t = entries.find((x) => x.path === hit?.closest<HTMLElement>("[data-path]")?.dataset.path);
      return t && t.type === "dir" && !moving.has(t.path) ? t.path : null;
    };
    const stop = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", stop, true);
      window.removeEventListener("keydown", key, true);
      if (!active) return;
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      setDrag(null);
      // 놓은 뒤 따라오는 click 한 번이 선택을 바꾸지 않도록(useMarquee와 같은 방식)
      dragged.current = true;
      setTimeout(() => (dragged.current = false), 0);
    };
    const move = (ev: PointerEvent) => {
      if (ev.buttons === 0) return stop();
      if (!active) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < THRESHOLD) return;
        active = true;
        el.setPointerCapture(pointerId);
        if (!selected.has(entry.path)) onStart(new Set([entry.path]));
      }
      over = folderAt(ev);
      setDrag({ x: ev.clientX, y: ev.clientY, count: items.length, over });
    };
    const up = () => {
      if (active && over) onDrop(items, over);
      stop();
    };
    const key = (ev: KeyboardEvent) => {
      if (ev.key !== "Escape") return;
      ev.preventDefault();
      ev.stopPropagation(); // 목록의 Esc(선택 해제)까지 가지 않게
      stop();
    };
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", stop, true);
    window.addEventListener("keydown", key, true);
    return true;
  };

  /** 컨테이너의 onClickCapture에 연결 */
  const onClickCapture = (e: RMouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.stopPropagation();
  };

  return { drag, onPointerDown, onClickCapture };
}
