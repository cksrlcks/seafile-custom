import { useCallback, useState } from "react";

const KEY = "seadrive.sidebar";
const DEFAULT = 224;
const MIN = 160;
const MAX = 480;

function load(): number {
  try {
    const n = Number(localStorage.getItem(KEY));
    return n >= MIN && n <= MAX ? n : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

/** 사이드바 너비. 오른쪽 경계를 끌어 조절하고 localStorage에 기억. useColumnWidths와 같은 방식 */
export function useSidebarWidth() {
  const [width, setWidth] = useState(load);

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      const onMove = (ev: PointerEvent) => setWidth(Math.min(MAX, Math.max(MIN, Math.round(startW + ev.clientX - startX))));
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setWidth((w) => {
          try {
            localStorage.setItem(KEY, String(w));
          } catch {
            /* ignore */
          }
          return w;
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [width],
  );

  return { width, startResize };
}
