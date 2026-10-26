import { IconRotateClockwise, IconUpload, IconX } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TransferPanel, TransferRow, type TransferState } from "@/features/transfer/TransferPanel";
import { formatSize } from "@/lib/format";
import type { UploadItem, UploadStatus } from "./uploadQueue";
import { useUploadQueue } from "./useUploadQueue";

const STATE: Record<UploadStatus, TransferState> = { queued: "queued", uploading: "active", done: "done", failed: "failed", cancelled: "cancelled" };
const LABEL: Record<UploadStatus, string> = { queued: "대기", uploading: "", done: "완료", failed: "실패", cancelled: "취소됨" };

export function UploadPanel() {
  const { queue, items } = useUploadQueue();
  const [expanded, setExpanded] = useState(false);

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const allDone = total > 0 && done === total;
  const busy = items.some((i) => i.status === "queued" || i.status === "uploading");
  const sent = items.reduce((a, i) => a + i.sent, 0);
  const bytes = items.reduce((a, i) => a + i.total, 0);
  const current = items.find((i) => i.status === "uploading");

  useEffect(() => {
    if (!allDone) return;
    const t = setTimeout(() => {
      setExpanded(false);
      queue.clearFinished();
    }, 3000);
    return () => clearTimeout(t);
  }, [allDone, queue]);

  if (total === 0) return null;

  return (
    <TransferPanel
      icon={<IconUpload className="size-4" />}
      title="업로드"
      done={done}
      total={total}
      percent={busy ? (bytes ? (sent / bytes) * 100 : 0) : undefined}
      detail={current ? `${current.task.file.name}  ${formatSize(current.sent)} / ${formatSize(current.total)}` : failed ? `${failed}개 실패` : ""}
      allDone={allDone}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      close={{
        title: "모두 취소",
        onClick: () => {
          queue.cancelAll();
          queue.clearFinished();
        },
      }}
    >
      {items.map((i) => (
        <Row key={i.id} item={i} onRetry={() => queue.retry(i.id)} onCancel={() => queue.cancel(i.id)} />
      ))}
    </TransferPanel>
  );
}

function Row({ item, onRetry, onCancel }: { item: UploadItem; onRetry(): void; onCancel(): void }) {
  const name = item.task.relativePath ? `${item.task.relativePath}/${item.task.file.name}` : item.task.file.name;
  const pct = item.total ? (item.sent / item.total) * 100 : item.status === "done" ? 100 : 0;
  const label = item.status === "uploading" ? `${formatSize(item.sent)} / ${formatSize(item.total)}` : LABEL[item.status];
  return (
    <TransferRow state={STATE[item.status]} name={name} percent={pct} label={label} labelTitle={item.error}>
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
    </TransferRow>
  );
}
