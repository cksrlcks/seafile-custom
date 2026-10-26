import { Download, Link, Pencil, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import {
  ContextMenu as Root,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { Entry } from "@/storage/StorageProvider";

export interface EntryMenuActions {
  onDownload(entry: Entry): void;
  onRename(entry: Entry): void;
  onShare?(entry: Entry): void;
  onDelete(entry: Entry): void;
}

/** 우클릭 메뉴. children이 트리거(카드) 또는 asRow면 테이블 행의 셀들. */
export function EntryContextMenu({ entry, actions, children, asRow, selected }: { entry: Entry; actions: EntryMenuActions; children: ReactNode; asRow?: boolean; selected?: boolean }) {
  const trigger = asRow ? (
    <tr className={"h-14 cursor-default select-none border-b border-border/60 last:border-0 hover:bg-accent/50" + (selected ? " bg-accent/40" : "")} />
  ) : (
    <div className="contents" />
  );
  return (
    <Root>
      <ContextMenuTrigger render={trigger}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {entry.type === "file" && (
          <ContextMenuItem onClick={() => actions.onDownload(entry)}>
            <Download className="size-4" /> 다운로드
          </ContextMenuItem>
        )}
        <ContextMenuItem onClick={() => actions.onRename(entry)}>
          <Pencil className="size-4" /> 이름 변경
        </ContextMenuItem>
        <ContextMenuItem disabled={!actions.onShare} onClick={() => actions.onShare?.(entry)}>
          <Link className="size-4" /> 공유 링크
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem variant="destructive" onClick={() => actions.onDelete(entry)}>
          <Trash2 className="size-4" /> 삭제
        </ContextMenuItem>
      </ContextMenuContent>
    </Root>
  );
}
