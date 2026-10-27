import { IconCircleCheckFilled, IconDownload, IconExclamationCircleFilled, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { dismissUpdate, installUpdate, useUpdater } from "./updater";

/** 우하단 업데이트 알림. 전송 패널과 같은 카드 모양. 새 버전·진행률·결과를 보여 준다 */
export function UpdateNotice() {
  const s = useUpdater();
  useEffect(() => {
    if (s.kind !== "none") return;
    const t = setTimeout(dismissUpdate, 3000);
    return () => clearTimeout(t);
  }, [s.kind]);

  if (s.kind === "idle" || s.kind === "checking") return null;
  return (
    <div className="w-96 rounded-xl bg-popover p-3 text-sm shadow-dialog animate-in fade-in-0 duration-100">
      {s.kind === "available" && (
        <div className="flex items-center gap-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <IconDownload className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-medium">새 버전 {s.version}</div>
            <div className="truncate text-2xs text-muted-foreground">{s.notes || "업데이트하면 앱이 다시 시작됩니다"}</div>
          </div>
          <Button size="sm" onClick={() => void installUpdate()}>
            업데이트
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={dismissUpdate} title="나중에">
            <IconX className="size-4" />
          </Button>
        </div>
      )}
      {s.kind === "downloading" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">업데이트 받는 중…</span>
            <span className="text-muted-foreground tabular-nums">{s.percent === null ? "" : `${Math.round(s.percent)}%`}</span>
          </div>
          <Progress value={s.percent ?? 0} />
        </div>
      )}
      {s.kind === "none" && (
        <div className="flex items-center gap-2 text-xs">
          <IconCircleCheckFilled className="size-4 text-success" /> 최신 버전입니다
        </div>
      )}
      {s.kind === "error" && (
        <div className="flex items-center gap-2 text-xs">
          <IconExclamationCircleFilled className="size-4 shrink-0 text-destructive" />
          <span className="min-w-0 flex-1">{s.message}</span>
          <Button variant="ghost" size="icon-sm" onClick={dismissUpdate} title="닫기">
            <IconX className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
