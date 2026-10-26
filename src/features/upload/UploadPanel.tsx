import { IconChevronDown, IconChevronUp, IconRotateClockwise, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatSize } from "@/lib/format";
import type { UploadItem, UploadStatus } from "./uploadQueue";
import { useUploadQueue } from "./useUploadQueue";

const STATUS_LABEL: Record<UploadStatus, string> = {
  queued: "대기",
  uploading: "진행 중",
  done: "완료",
  failed: "실패",
  cancelled: "취소됨",
};

export function UploadPanel() {
  const { queue, items } = useUploadQueue();
  const [expanded, setExpanded] = useState(false);

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const allFinished = total > 0 && items.every((i) => i.status === "done");
  const sent = items.reduce((a, i) => a + i.sent, 0);
  const bytes = items.reduce((a, i) => a + i.total, 0);
  const current = items.find((i) => i.status === "uploading");

  useEffect(() => {
    if (!allFinished) return;
    const t = setTimeout(() => {
      setExpanded(false);
      queue.clearFinished();
    }, 3000);
    return () => clearTimeout(t);
  }, [allFinished, queue]);

  if (total === 0) return null;

  return (
    <div className="w-96 rounded-lg border border-border bg-popover text-sm shadow-float">
      <div className="flex h-9 items-center gap-2.5 px-3">
        <span className="shrink-0 font-medium">
          업로드 {done}/{total}
        </span>
        <Progress value={bytes ? (sent / bytes) * 100 : 0} className="w-28" />
        <span className="min-w-0 flex-1 truncate text-2xs text-muted-foreground">
          {current ? `${current.task.file.name}  ${formatSize(current.sent)} / ${formatSize(current.total)}` : allFinished ? "모두 완료" : ""}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => setExpanded((v) => !v)} title={expanded ? "접기" : "펼치기"}>
          {expanded ? <IconChevronDown className="size-4" /> : <IconChevronUp className="size-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          title="모두 취소"
          onClick={() => {
            queue.cancelAll();
            queue.clearFinished();
          }}
        >
          <IconX className="size-4" />
        </Button>
      </div>
      {expanded && (
        <ul className="max-h-48 overflow-auto border-t border-border py-1">
          {items.map((i) => (
            <Row key={i.id} item={i} onRetry={() => queue.retry(i.id)} onCancel={() => queue.cancel(i.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ item, onRetry, onCancel }: { item: UploadItem; onRetry(): void; onCancel(): void }) {
  const name = item.task.relativePath ? `${item.task.relativePath}/${item.task.file.name}` : item.task.file.name;
  const pct = item.total ? (item.sent / item.total) * 100 : item.status === "done" ? 100 : 0;
  return (
    <li className="flex h-7 items-center gap-2 px-3 text-xs">
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <Progress value={pct} className="w-20" />
      <span className={item.status === "failed" ? "w-12 text-2xs text-destructive" : "w-12 text-2xs text-muted-foreground"} title={item.error}>
        {STATUS_LABEL[item.status]}
      </span>
      {(item.status === "failed" || item.status === "cancelled") && (
        <Button variant="ghost" size="icon-xs" onClick={onRetry} title="재시도">
          <IconRotateClockwise className="size-3" />
        </Button>
      )}
      {(item.status === "uploading" || item.status === "queued") && (
        <Button variant="ghost" size="icon-xs" onClick={onCancel} title="취소">
          <IconX className="size-3" />
        </Button>
      )}
    </li>
  );
}
