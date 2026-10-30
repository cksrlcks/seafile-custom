import { IconFolderOpen, IconSend, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { revealInFolder } from "@/features/download/useDownloads";
import { TransferPanel, TransferRow, type TransferState } from "@/features/transfer/TransferPanel";
import { formatSize } from "@/lib/format";
import { cancelTransfer, finished, nearby, useNearby, type Transfer, type TransferStatus } from "./nearby";

const STATE: Record<TransferStatus, TransferState> = { preparing: "active", asking: "queued", active: "active", done: "done", declined: "cancelled", failed: "failed", canceled: "cancelled" };
const LABEL: Record<TransferStatus, string> = { preparing: "준비 중", asking: "수락 대기", active: "", done: "완료", declined: "거절됨", failed: "실패", canceled: "취소됨" };

/** 우하단 근처로 보내기 패널. 보내기·받기를 한 패널에 */
export function NearbyPanel() {
  const { transfers } = useNearby();
  const [expanded, setExpanded] = useState(true);
  if (transfers.length === 0) return null;

  const done = transfers.filter((t) => t.status === "done").length;
  const busy = transfers.filter((t) => !finished(t));
  const failed = transfers.filter((t) => t.status === "failed").length;
  const moving = busy.filter((t) => t.status === "active" || t.status === "preparing");
  const sum = (k: "done" | "total") => moving.reduce((a, t) => a + t[k], 0);
  const current = busy[0];

  return (
    <TransferPanel
      icon={<IconSend className="size-4" />}
      title="근처로 보내기"
      done={done}
      total={transfers.length}
      percent={moving.length ? (sum("total") ? (sum("done") / sum("total")) * 100 : 0) : undefined}
      detail={current ? `${current.send ? "→" : "←"} ${current.peer}  ${LABEL[current.status] || `${formatSize(current.done)} / ${formatSize(current.total)}`}` : failed ? `${failed}개 실패` : ""}
      allDone={done === transfers.length}
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      close={{ title: "끝난 항목 지우기", disabled: !transfers.some(finished), onClick: nearby.clearFinished }}
    >
      {transfers.map((t) => (
        <Row key={t.id} t={t} />
      ))}
    </TransferPanel>
  );
}

function Row({ t }: { t: Transfer }) {
  const files = t.count > 1 ? `${t.name} 외 ${t.count - 1}개` : t.name;
  const pct = t.total ? (t.done / t.total) * 100 : t.status === "done" ? 100 : 0;
  // 거절 사유(거절·응답 없음)는 짧아서 그대로, 실패 사유는 길 수 있어 마우스를 올렸을 때
  const label = t.status === "active" ? `${formatSize(t.done)} / ${formatSize(t.total)}` : (t.status === "declined" && t.error) || LABEL[t.status];
  // 준비 중(드라이브에서 임시로 받는 중)은 아직 Rust 쪽 전송이 아니라 취소할 수 없다
  const cancelable = t.status === "asking" || t.status === "active";
  return (
    <TransferRow state={STATE[t.status]} name={`${t.send ? "→" : "←"} ${t.peer} · ${files}`} title={files} percent={pct} label={label} labelTitle={t.error ?? undefined}>
      {cancelable && (
        <Button variant="ghost" size="icon-xs" onClick={() => void cancelTransfer(t.id)} title="취소">
          <IconX className="size-3" />
        </Button>
      )}
      {t.status === "done" && t.path && (
        <Button variant="ghost" size="icon-xs" onClick={() => void revealInFolder(t.path!)} title="폴더 열기">
          <IconFolderOpen className="size-3.5" />
        </Button>
      )}
    </TransferRow>
  );
}
