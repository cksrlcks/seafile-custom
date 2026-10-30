import { IconBuildingBroadcastTower, IconFolderOpen, IconX } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { revealInFolder } from "@/features/download/useDownloads";
import { TransferPanel, TransferRow, type TransferState } from "@/features/transfer/TransferPanel";
import { formatSize } from "@/lib/format";
import { cancelTransfer, finished, nearby, useNearby, type Transfer } from "./nearby";

/** 패널 한 줄의 상태 아이콘과 오른쪽 글씨. 드라이브로 받기는 받은 뒤 올리는 단계까지 */
function view(t: Transfer): { state: TransferState; label: string } {
  if (t.stage === "uploading") return { state: "active", label: "드라이브에 올리는 중" };
  if (t.stage === "upload-failed") return { state: "failed", label: "올리기 실패" };
  switch (t.status) {
    case "preparing":
      return { state: "active", label: "준비 중" };
    case "asking":
      return { state: "queued", label: "수락 기다리는 중" };
    case "active":
      return { state: "active", label: `${formatSize(t.done)} / ${formatSize(t.total)}` };
    case "done":
      return { state: "done", label: t.stage === "uploaded" ? "드라이브에 저장" : t.send ? "보냄" : "받음" };
    // 거절 사유(거절·응답 없음)는 짧아서 그대로
    case "declined":
      return { state: "cancelled", label: t.error || "거절됨" };
    case "canceled":
      return { state: "cancelled", label: "취소됨" };
    case "failed":
      return { state: "failed", label: "실패" };
  }
}

/** 우하단 바로 보내기 패널. 보내기·받기를 한 패널에 */
export function NearbyPanel() {
  const { transfers } = useNearby();
  const [expanded, setExpanded] = useState(true);
  if (transfers.length === 0) return null;

  const done = transfers.filter(finished).filter((t) => t.status === "done").length;
  const busy = transfers.filter((t) => !finished(t));
  const failed = transfers.filter((t) => t.status === "failed" || t.stage === "upload-failed").length;
  const moving = busy.filter((t) => t.status === "active" || t.status === "preparing");
  const sum = (k: "done" | "total") => moving.reduce((a, t) => a + t[k], 0);
  const current = busy[0];

  return (
    <TransferPanel
      icon={<IconBuildingBroadcastTower className="size-4" />}
      title="바로 보내기"
      done={done}
      total={transfers.length}
      percent={moving.length ? (sum("total") ? (sum("done") / sum("total")) * 100 : 0) : undefined}
      detail={current ? `${who(current)} · ${view(current).label}` : failed ? `${failed}개 실패` : ""}
      allDone={transfers.every((t) => finished(t) && t.status === "done" && t.stage !== "upload-failed")}
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

const who = (t: Transfer) => (t.send ? `${t.peer}에게` : `${t.peer}에게서`);

function Row({ t }: { t: Transfer }) {
  const files = t.count > 1 ? `${t.name} 외 ${t.count - 1}개` : t.name;
  const { state, label } = view(t);
  const pct = t.total ? (t.done / t.total) * 100 : t.status === "done" ? 100 : 0;
  // 준비 중(드라이브에서 임시로 받는 중)은 아직 Rust 쪽 전송이 아니라 취소할 수 없다
  const cancelable = t.status === "asking" || t.status === "active";
  return (
    <TransferRow state={state} name={`${who(t)} · ${files}`} title={files} percent={pct} label={label} labelTitle={[t.error, t.note].filter(Boolean).join("\n") || undefined}>
      {cancelable && (
        <Button variant="ghost" size="icon-xs" onClick={() => void cancelTransfer(t.id)} title="취소">
          <IconX className="size-3" />
        </Button>
      )}
      {t.status === "done" && t.path && (
        <Button variant="ghost" size="icon-xs" onClick={() => void revealInFolder(t.path!)} title={t.note ?? "폴더 열기"}>
          <IconFolderOpen className="size-3.5" />
        </Button>
      )}
    </TransferRow>
  );
}
