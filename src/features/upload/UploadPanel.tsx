import { ChevronDown, ChevronUp, RotateCcw, X } from "lucide-react";
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
    <div className="mt-3 shrink-0 rounded-2xl border border-border bg-card text-sm shadow-sm">
      <div className="flex h-11 items-center gap-3 px-4">
        <span className="shrink-0 font-medium">
          업로드 {done}/{total}
        </span>
        <Progress value={bytes ? (sent / bytes) * 100 : 0} className="w-48" />
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {current ? `${current.task.file.name}  ${formatSize(current.sent)} / ${formatSize(current.total)}` : allFinished ? "모두 완료" : ""}
        </span>
        <Button variant="ghost" size="icon-sm" onClick={() => setExpanded((v) => !v)} title={expanded ? "접기" : "펼치기"}>
          {expanded ? <ChevronDown className="size-4" /> : <ChevronUp className="size-4" />}
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
          <X className="size-4" />
        </Button>
      </div>
      {expanded && (
        <ul className="max-h-56 overflow-auto border-t border-border py-1">
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
    <li className="flex h-9 items-center gap-3 px-4">
      <span className="min-w-0 flex-1 truncate">{name}</span>
      <Progress value={pct} className="w-32" />
      <span className={item.status === "failed" ? "w-14 text-xs text-destructive" : "w-14 text-xs text-muted-foreground"} title={item.error}>
        {STATUS_LABEL[item.status]}
      </span>
      {(item.status === "failed" || item.status === "cancelled") && (
        <Button variant="ghost" size="icon-xs" onClick={onRetry} title="재시도">
          <RotateCcw className="size-3" />
        </Button>
      )}
      {(item.status === "uploading" || item.status === "queued") && (
        <Button variant="ghost" size="icon-xs" onClick={onCancel} title="취소">
          <X className="size-3" />
        </Button>
      )}
    </li>
  );
}
