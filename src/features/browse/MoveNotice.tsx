import { IconCircleCheckFilled, IconX } from "@tabler/icons-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import type { MoveOp } from "./useEntryActions";

/** 끌어서 옮긴 뒤 우하단 알림. 잘못 놓았을 때 되돌릴 수 있게 잠시 실행 취소(Ctrl+Z)를 띄운다 */
export function MoveNotice({ op, dstName, onUndo, onClose }: { op: MoveOp; dstName: string; onUndo(): void; onClose(): void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 8000);
    return () => clearTimeout(t);
  }, [op, onClose]);

  const what = op.names.length === 1 ? `'${op.names[0]}'` : `${op.names.length}개 항목`;
  return (
    <div className="flex w-96 items-center gap-2 rounded-xl bg-popover p-3 text-xs shadow-dialog animate-in fade-in-0 duration-100">
      <IconCircleCheckFilled className="size-4 shrink-0 text-success" />
      <span className="min-w-0 flex-1 truncate">
        {what}을(를) '{dstName}'(으)로 옮겼습니다
      </span>
      <Button variant="outline" size="xs" onClick={onUndo}>
        실행 취소
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={onClose} title="닫기">
        <IconX className="size-4" />
      </Button>
    </div>
  );
}
