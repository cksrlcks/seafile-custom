import { IconChevronDown, IconChevronUp, IconFolderOpen, IconRotateClockwise, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatSize } from "@/lib/format";
import type { DownloadItem, DownloadStatus } from "./downloadQueue";
import { downloads, revealInFolder, useDownloads } from "./useDownloads";

const STATUS_LABEL: Record<DownloadStatus, string> = { queued: "대기", downloading: "받는 중", done: "완료", failed: "실패" };

/** 우하단 다운로드 패널. 업로드 패널과 같은 모양. 완료 항목은 "폴더 열기"를 누를 수 있도록 남겨 둔다. */
export function DownloadPanel() {
  const items = useDownloads();
  const [expanded, setExpanded] = useState(true);
  if (items.length === 0) return null;

  const done = items.filter((i) => i.status === "done").length;
  const received = items.reduce((a, i) => a + i.received, 0);
  const total = items.reduce((a, i) => a + i.total, 0);
  const current = items.find((i) => i.status === "downloading");
  const finished = items.every((i) => i.status === "done" || i.status === "failed");

  return (
    <div className="w-96 rounded-lg border border-border bg-popover text-sm shadow-float">
      <div className="flex h-9 items-center gap-2.5 px-3">
        <span className="shrink-0 font-medium">
          다운로드 {done}/{items.length}
        </span>
        <Progress value={total ? (received / total) * 100 : 0} className="w-28" />
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
          {current ? `${current.job.name}  ${formatSize(current.received)} / ${formatSize(current.total)}` : finished ? "모두 끝남" : ""}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => setExpanded((v) => !v)} title={expanded ? "접기" : "펼치기"}>
          {expanded ? <IconChevronDown className="size-4" /> : <IconChevronUp className="size-4" />}
        </Button>
        <Button variant="ghost" size="icon-sm" title="완료 항목 지우기" disabled={!items.some((i) => i.status === "done" || i.status === "failed")} onClick={() => downloads.clearFinished()}>
          <IconX className="size-4" />
        </Button>
      </div>
      {expanded && (
        <ul className="max-h-48 overflow-auto border-t border-border py-1">
          {items.map((i) => (
            <Row key={i.id} item={i} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ item }: { item: DownloadItem }) {
  const pct = item.total ? (item.received / item.total) * 100 : item.status === "done" ? 100 : 0;
  return (
    <li className="flex h-7 items-center gap-2 px-3 text-xs">
      <span className="min-w-0 flex-1 truncate" title={item.job.path}>
        {item.job.name}
      </span>
      <Progress value={pct} className="w-20" />
      <span className={item.status === "failed" ? "w-12 text-2xs text-destructive" : "w-12 text-2xs text-muted-foreground"} title={item.error}>
        {STATUS_LABEL[item.status]}
      </span>
      {item.status === "done" && (
        <Button variant="ghost" size="icon-xs" onClick={() => void revealInFolder(item.job.path)} title="폴더 열기">
          <IconFolderOpen className="size-3.5" />
        </Button>
      )}
      {item.status === "failed" && (
        <Button variant="ghost" size="icon-xs" onClick={() => downloads.retry(item.id)} title="재시도">
          <IconRotateClockwise className="size-3" />
        </Button>
      )}
    </li>
  );
}
