import { IconDownload, IconLink, IconPencil, IconTrash, IconX } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** 항목을 선택하면 목록 하단 가운데에 떠 있는 액션 모음의 껍데기. 파일 목록·공유 링크 페이지가 같이 쓴다 */
export function SelectionBar({ count, onClear, children }: { count: number; onClear(): void; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-popover px-2.5 py-2 text-sm shadow-float animate-in fade-in-0 slide-in-from-bottom-3 duration-200">
      <span className="shrink-0 pr-3 pl-1 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
        <span className="font-medium text-foreground">{count}</span>개 선택
      </span>
      <span className="h-5 w-px shrink-0 bg-border" />
      {children}
      <span className="ml-1 h-5 w-px shrink-0 bg-border" />
      <Button variant="ghost" size="icon-sm" onClick={onClear} title="선택 해제" className="ml-0.5">
        <IconX className="size-4" />
      </Button>
    </div>
  );
}

type FileProps = {
  count: number;
  hasFile: boolean;
  onDownload(): void;
  onShare(): void;
  onRename(): void;
  onDelete(): void;
  onClear(): void;
  /** 읽기 전용 저장소: 이름 변경·삭제를 끈다 */
  readOnly?: boolean;
};

/** 파일 목록용. 메뉴바 편집 메뉴와 같은 동작·활성 조건 */
export function FileSelectionBar({ count, hasFile, onDownload, onShare, onRename, onDelete, onClear, readOnly }: FileProps) {
  return (
    <SelectionBar count={count} onClear={onClear}>
      <Button variant="ghost" size="sm" onClick={onDownload} disabled={!hasFile} className="px-3">
        <IconDownload className="size-4" stroke={1.75} /> 다운로드
      </Button>
      <Button variant="ghost" size="sm" onClick={onShare} disabled={count !== 1} className="px-3">
        <IconLink className="size-4" stroke={1.75} /> 공유 링크
      </Button>
      <Button variant="ghost" size="sm" onClick={onRename} disabled={readOnly || count !== 1} className="px-3">
        <IconPencil className="size-4" stroke={1.75} /> 이름 변경
      </Button>
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={readOnly} className="px-3 text-destructive hover:text-destructive">
        <IconTrash className="size-4" stroke={1.75} /> 삭제
      </Button>
    </SelectionBar>
  );
}
