import { IconDownload, IconFolderOpen, IconRotateClockwise } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransferPanel, TransferRow, type TransferState } from "@/features/transfer/TransferPanel";
import { formatSize } from "@/lib/format";
import type { DownloadItem, DownloadStatus } from "./downloadQueue";
import { downloads, revealInFolder, useDownloads } from "./useDownloads";

const STATE: Record<DownloadStatus, TransferState> = { queued: "queued", downloading: "active", done: "done", failed: "failed" };
const LABEL: Record<DownloadStatus, string> = { queued: "대기", downloading: "", done: "완료", failed: "실패" };

/** 우하단 다운로드 패널. 업로드 패널과 같은 모양. 완료 항목은 "폴더 열기"를 누를 수 있도록 남겨 둔다. */
export function DownloadPanel() {
  const items = useDownloads();
  const [expanded, setExpanded] = useState(true);
  if (items.length === 0) return null;

  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed").length;
  const allDone = done === items.length;
  const busy = items.some((i) => i.status === "queued" || i.status === "downloading");
  const received = items.reduce((a, i) => a + i.received, 0);
  const total = items.reduce((a, i) => a + i.total, 0);
  const current = items.find((i) => i.status === "downloading");

  return (
    <TransferPanel
      icon={<IconDownload className="size-4" />}
      title="다운로드"
      done={done}
      total={items.length}
      percent={busy ? (total ? (received / total) * 100 : 0) : undefined}
      detail={current ? `${current.job.name}  ${formatSize(current.received)} / ${formatSize(current.total)}` : failed ? `${failed}개 실패` : ""}
      allDone={allDone}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      close={{ title: "완료 항목 지우기", disabled: !items.some((i) => i.status === "done" || i.status === "failed"), onClick: () => downloads.clearFinished() }}
    >
      {items.map((i) => (
        <Row key={i.id} item={i} />
      ))}
    </TransferPanel>
  );
}

function Row({ item }: { item: DownloadItem }) {
  const pct = item.total ? (item.received / item.total) * 100 : item.status === "done" ? 100 : 0;
  const label = item.status === "downloading" ? `${formatSize(item.received)} / ${formatSize(item.total)}` : LABEL[item.status];
  return (
    <TransferRow state={STATE[item.status]} name={item.job.name} title={item.job.path} percent={pct} label={label} labelTitle={item.error}>
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
    </TransferRow>
  );
}
