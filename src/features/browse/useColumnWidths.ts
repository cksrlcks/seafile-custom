import { useCallback, useState } from "react";

export type ColKey = "mtime" | "size";
const KEY = "seadrive.columns";
const DEFAULT: Record<ColKey, number> = { mtime: 176, size: 96 };
const MIN: Record<ColKey, number> = { mtime: 90, size: 64 };

function load(): Record<ColKey, number> {
  try {
    return { ...DEFAULT, ...(JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Record<ColKey, number>>) };
  } catch {
    return DEFAULT;
  }
}

/** 표 열 너비. 이름 열은 남는 공간, 나머지는 px. 드래그로 조절하고 localStorage에 기억. */
export function useColumnWidths() {
  const [widths, setWidths] = useState(load);

  const startResize = useCallback(
    (key: ColKey, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = widths[key];
      const onMove = (ev: PointerEvent) => {
        const w = Math.max(MIN[key], Math.round(startW - (ev.clientX - startX)));
        setWidths((s) => (s[key] === w ? s : { ...s, [key]: w }));
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setWidths((s) => {
          try {
            localStorage.setItem(KEY, JSON.stringify(s));
          } catch {
            /* ignore */
          }
          return s;
        });
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [widths],
  );

  return { widths, startResize };
}
