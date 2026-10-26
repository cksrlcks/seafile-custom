import {
  IconChevronDown,
  IconChevronUp,
  IconCircleCheckFilled,
  IconCircleDashed,
  IconCircleXFilled,
  IconExclamationCircleFilled,
  IconLoader2,
  IconX,
} from "@tabler/icons-react";
import { cn } from "cn";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export type TransferState = "queued" | "active" | "done" | "failed" | "cancelled";

type PanelProps = {
  icon: ReactNode;
  title: string;
  done: number;
  total: number;
  /** 전체 진행률. undefined면 막대를 숨긴다(끝난 상태) */
  percent?: number;
  /** 머리글 둘째 줄: 진행 중 파일, 실패 개수 등 */
  detail: string;
  allDone: boolean;
  expanded: boolean;
  onToggle(): void;
  close: { title: string; disabled?: boolean; onClick(): void };
  children: ReactNode;
};

/** 우하단 전송 패널 껍데기. 업로드·다운로드가 같은 모양을 쓴다. */
export function TransferPanel({ icon, title, done, total, percent, detail, allDone, expanded, onToggle, close, children }: PanelProps) {
  return (
    <div className="w-96 overflow-hidden rounded-xl border border-border bg-popover text-sm shadow-float animate-in fade-in-0 slide-in-from-bottom-3 duration-200">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", allDone ? "bg-success/10 text-success" : "bg-primary/10 text-primary")}>
          {allDone ? <IconCircleCheckFilled className="size-5 animate-in zoom-in-50 duration-300" /> : icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-medium">{title}</span>
            <span className="text-2xs text-muted-foreground tabular-nums">
              {done}/{total}
            </span>
          </div>
          <div className={cn("truncate text-2xs", allDone ? "text-success" : "text-muted-foreground")}>{allDone ? "모두 완료" : detail}</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onToggle} title={expanded ? "접기" : "펼치기"}>
          {expanded ? <IconChevronDown className="size-4" /> : <IconChevronUp className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" title={close.title} disabled={close.disabled} onClick={close.onClick}>
          <IconX className="size-4" />
        </Button>
      </div>
      {percent !== undefined && <Progress value={percent} className="px-3 pb-2.5" />}
      {expanded && <ul className="max-h-56 overflow-auto border-t border-border py-1 animate-in fade-in-0 slide-in-from-top-1 duration-150">{children}</ul>}
    </div>
  );
}

const STATE_ICON: Record<TransferState, ReactNode> = {
  queued: <IconCircleDashed className="size-4 text-muted-foreground/60" />,
  active: <IconLoader2 className="size-4 animate-spin text-primary" />,
  done: <IconCircleCheckFilled className="size-4 text-success animate-in zoom-in-50 duration-300" />,
  failed: <IconExclamationCircleFilled className="size-4 text-destructive" />,
  cancelled: <IconCircleXFilled className="size-4 text-muted-foreground/60" />,
};

type RowProps = {
  state: TransferState;
  name: string;
  title?: string;
  percent: number;
  /** 오른쪽 작은 글씨: 받은 바이트, 상태, 실패 */
  label: string;
  labelTitle?: string;
  /** 행 동작 버튼 */
  children?: ReactNode;
};

export function TransferRow({ state, name, title, percent, label, labelTitle, children }: RowProps) {
  return (
    <li className="flex items-center gap-2.5 px-3 py-1.5 text-xs animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
      <span className="flex size-4 shrink-0 items-center justify-center">{STATE_ICON[state]}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate" title={title}>
          {name}
        </div>
        {state === "active" && <Progress value={percent} className="mt-1" />}
      </div>
      <span className={cn("shrink-0 text-2xs tabular-nums", state === "failed" ? "text-destructive" : "text-muted-foreground")} title={labelTitle}>
        {label}
      </span>
      {children}
    </li>
  );
}
