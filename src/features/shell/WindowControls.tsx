import { Copy, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "cn";

/** Windows 11 캡션 버튼 규격: 46×32, 닫기는 빨강 호버 */
export function WindowControls() {
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      setMaximized(await w.isMaximized());
      unlisten = await w.onResized(async () => setMaximized(await w.isMaximized()));
    });
    return () => unlisten?.();
  }, []);
  const call = (fn: "minimize" | "toggleMaximize" | "close") => () =>
    void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow()[fn]());

  const btn = "flex h-9 w-11.5 items-center justify-center text-foreground/80 transition-colors";
  return (
    <div className="flex shrink-0 self-start">
      <button type="button" aria-label="최소화" onClick={call("minimize")} className={cn(btn, "hover:bg-accent")}>
        <Minus className="size-3.5" strokeWidth={1.5} />
      </button>
      <button type="button" aria-label={maximized ? "이전 크기로" : "최대화"} onClick={call("toggleMaximize")} className={cn(btn, "hover:bg-accent")}>
        {maximized ? <Copy className="size-3 -scale-x-100" strokeWidth={1.5} /> : <Square className="size-3" strokeWidth={1.5} />}
      </button>
      <button type="button" aria-label="닫기" onClick={call("close")} className={cn(btn, "hover:bg-destructive hover:text-primary-foreground")}>
        <X className="size-4" strokeWidth={1.5} />
      </button>
    </div>
  );
}
