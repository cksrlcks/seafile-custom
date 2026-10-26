import { IconArrowDown, IconArrowUp, IconFile, IconFileZip, IconFileMusic, IconCode, IconPhoto, IconFileSpreadsheet, IconFileText, IconMovie, IconFolder } from "@tabler/icons-react";
import { cn } from "cn";
import { formatDateLong, formatSize } from "@/lib/format";
import type { Entry } from "@/storage/StorageProvider";
import { EntryContextMenu, type EntryMenuActions } from "./ContextMenu";
import { InlineName } from "./InlineName";
import { useColumnWidths, type ColKey } from "./useColumnWidths";

export type ViewMode = "list" | "grid";
export type SortKey = "name" | "mtime" | "size";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

/** 폴더 먼저(이름순), 파일은 정렬 기준대로 — Finder/탐색기 관례 */
export function orderEntries(list: Entry[], sort: Sort): Entry[] {
  const m = sort.dir === "asc" ? 1 : -1;
  const cmp = (a: Entry, b: Entry) => (sort.key === "name" ? a.name.localeCompare(b.name) * m : (a[sort.key] - b[sort.key]) * m);
  const dirs = list.filter((e) => e.type === "dir").sort((a, b) => a.name.localeCompare(b.name) * (sort.key === "name" ? m : 1));
  const files = list.filter((e) => e.type === "file").sort(cmp);
  return [...dirs, ...files];
}

const ICONS: Record<string, typeof IconFile> = {
  png: IconPhoto, jpg: IconPhoto, jpeg: IconPhoto, gif: IconPhoto, webp: IconPhoto, svg: IconPhoto, bmp: IconPhoto, heic: IconPhoto,
  mp4: IconMovie, mov: IconMovie, mkv: IconMovie, avi: IconMovie, webm: IconMovie,
  mp3: IconFileMusic, wav: IconFileMusic, flac: IconFileMusic, m4a: IconFileMusic,
  zip: IconFileZip, "7z": IconFileZip, rar: IconFileZip, tar: IconFileZip, gz: IconFileZip,
  xlsx: IconFileSpreadsheet, xls: IconFileSpreadsheet, csv: IconFileSpreadsheet,
  txt: IconFileText, md: IconFileText, pdf: IconFileText, doc: IconFileText, docx: IconFileText, hwp: IconFileText,
  js: IconCode, ts: IconCode, tsx: IconCode, jsx: IconCode, py: IconCode, rs: IconCode, go: IconCode, json: IconCode, html: IconCode, css: IconCode, sh: IconCode,
};

/** 검색 결과의 위치: 기준 폴더 아래 상대 경로 ("· 문서/2025"), 기준 폴더 바로 아래면 "· 이 폴더" */
export function locationLabel(root: string, path: string): string {
  const parent = path.slice(0, path.lastIndexOf("/")) || "/";
  const rel = parent === root ? "" : parent.slice(root === "/" ? 1 : root.length + 1);
  return rel ? `· ${rel}` : "· 이 폴더";
}

export function EntryIcon({ entry, className }: { entry: Entry; className?: string }) {
  if (entry.type === "dir") return <IconFolder className={cn("size-4 fill-primary/20 text-primary", className)} />;
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = ICONS[ext] ?? File;
  return <Icon className={cn("size-4 text-muted-foreground", className)} stroke={1.75} />;
}

export interface ListProps {
  entries: Entry[];
  /** 검색 결과일 때 기준 폴더. 각 항목의 상위 위치를 이 기준으로 보여 준다 */
  locationRoot?: string | null;
  sort: Sort;
  onSort(key: SortKey): void;
  selected: Set<string>;
  focusPath: string | null;
  onSelect(entry: Entry, e: React.MouseEvent): void;
  onOpen(entry: Entry): void;
  actions: EntryMenuActions;
  existingNames: string[];
  renamingPath: string | null;
  onRenameSubmit(entry: Entry, newName: string): void;
  onRenameCancel(): void;
  creatingFolder: boolean;
  onCreateFolder(name: string): void;
  onCreateFolderCancel(): void;
}

/** 표 보기: 24px 머리글, 28px 행, 줄무늬, 전체 행 선택 */
export function FileList(p: ListProps) {
  const { widths, startResize } = useColumnWidths();
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <colgroup>
        <col />
        <col style={{ width: widths.mtime }} />
        <col style={{ width: widths.size }} />
      </colgroup>
      <thead className="sticky top-0 z-10 bg-background">
        <tr className="h-7 border-b border-border text-2xs text-muted-foreground">
          <Th label="이름" k="name" sort={p.sort} onSort={p.onSort} className="pl-3" resize="mtime" onResize={startResize} />
          <Th label="수정일" k="mtime" sort={p.sort} onSort={p.onSort} className="pl-3" resize="size" onResize={startResize} />
          <Th label="크기" k="size" sort={p.sort} onSort={p.onSort} className="pr-3 pl-3 text-right" />
        </tr>
      </thead>
      <tbody>
        {p.creatingFolder && (
          <tr className="h-8.5">
            <td className="pl-3" colSpan={3}>
              <span className="flex items-center gap-2">
                <IconFolder className="size-4 fill-primary/20 text-primary" />
                <InlineName initial="새 폴더" existing={p.existingNames} onSubmit={p.onCreateFolder} onCancel={p.onCreateFolderCancel} className="h-6 max-w-xs text-sm md:text-sm" />
              </span>
            </td>
          </tr>
        )}
        {p.entries.map((e, i) => {
          const sel = p.selected.has(e.path);
          return (
            <EntryContextMenu
              key={e.path}
              entry={e}
              actions={p.actions}
              asRow
              dataPath={e.path}
              className={cn(
                "h-8.5 cursor-default select-none",
                i % 2 === 1 && !sel && "bg-muted/60",
                sel && "bg-selection",
                p.focusPath === e.path && "outline-1 -outline-offset-1 outline-primary/60",
              )}
              onClick={(ev) => p.onSelect(e, ev)}
              onDoubleClick={() => p.renamingPath !== e.path && p.onOpen(e)}
              onContextMenu={() => !sel && p.onSelect(e, { ctrlKey: false, metaKey: false, shiftKey: false } as React.MouseEvent)}
            >
              <td className="pl-3">
                <span className="flex items-center gap-2">
                  <EntryIcon entry={e} />
                  {p.renamingPath === e.path ? (
                    <InlineName initial={e.name} existing={p.existingNames.filter((n) => n !== e.name)} onSubmit={(n) => p.onRenameSubmit(e, n)} onCancel={p.onRenameCancel} className="h-6 max-w-sm text-sm md:text-sm" />
                  ) : (
                    <span className="truncate">{e.name}</span>
                  )}
                  {p.locationRoot != null && p.renamingPath !== e.path && (
                    <span className="truncate text-2xs text-muted-foreground">{locationLabel(p.locationRoot, e.path)}</span>
                  )}
                </span>
              </td>
              <td className="truncate pl-3 text-muted-foreground">{formatDateLong(e.mtime)}</td>
              <td className="truncate pr-3 pl-3 text-right text-muted-foreground tabular-nums">{e.type === "file" ? formatSize(e.size) : ""}</td>
            </EntryContextMenu>
          );
        })}
      </tbody>
    </table>
  );
}

/** 머리글 셀. resize가 있으면 오른쪽 경계를 끌어 "다음 열"의 너비를 조절한다(탐색기와 같은 방식). */
function Th({ label, k, sort, onSort, className, resize, onResize }: { label: string; k: SortKey; sort: Sort; onSort(k: SortKey): void; className?: string; resize?: ColKey; onResize?(key: ColKey, e: React.PointerEvent): void }) {
  const active = sort.key === k;
  return (
    <th className={cn("relative cursor-default overflow-hidden text-left font-normal whitespace-nowrap select-none hover:bg-accent", className)} onClick={() => onSort(k)}>
      <span className="inline-flex max-w-full items-center gap-1 truncate">
        {label}
        {active && (sort.dir === "asc" ? <IconArrowUp className="size-3" /> : <IconArrowDown className="size-3" />)}
      </span>
      {resize && (
        <span
          role="separator"
          aria-orientation="vertical"
          onPointerDown={(e) => onResize?.(resize, e)}
          onClick={(e) => e.stopPropagation()}
          className="group absolute top-0 right-0 bottom-0 z-20 w-2 translate-x-1/2 cursor-col-resize"
        >
          <span className="absolute top-1.5 bottom-1.5 left-1/2 w-px bg-border group-hover:bg-primary" />
        </span>
      )}
    </th>
  );
}

export function FileListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={cn("h-8.5", i % 2 === 1 && "bg-muted/60")}>
          <div className="ml-3 mt-2.5 h-3.5 w-48 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
