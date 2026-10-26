import { ArrowDown, ArrowUp, File, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo, Folder } from "lucide-react";
import { cn } from "cn";
import { formatDateLong, formatSize } from "@/lib/format";
import type { Entry } from "@/storage/StorageProvider";
import { EntryContextMenu, type EntryMenuActions } from "./ContextMenu";
import { InlineName } from "./InlineName";

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

const ICONS: Record<string, typeof File> = {
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, webp: FileImage, svg: FileImage, bmp: FileImage, heic: FileImage,
  mp4: FileVideo, mov: FileVideo, mkv: FileVideo, avi: FileVideo, webm: FileVideo,
  mp3: FileAudio, wav: FileAudio, flac: FileAudio, m4a: FileAudio,
  zip: FileArchive, "7z": FileArchive, rar: FileArchive, tar: FileArchive, gz: FileArchive,
  xlsx: FileSpreadsheet, xls: FileSpreadsheet, csv: FileSpreadsheet,
  txt: FileText, md: FileText, pdf: FileText, doc: FileText, docx: FileText, hwp: FileText,
  js: FileCode, ts: FileCode, tsx: FileCode, jsx: FileCode, py: FileCode, rs: FileCode, go: FileCode, json: FileCode, html: FileCode, css: FileCode, sh: FileCode,
};

export function EntryIcon({ entry, className }: { entry: Entry; className?: string }) {
  if (entry.type === "dir") return <Folder className={cn("size-4 fill-primary/20 text-primary", className)} />;
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = ICONS[ext] ?? File;
  return <Icon className={cn("size-4 text-muted-foreground", className)} strokeWidth={1.75} />;
}

export interface ListProps {
  entries: Entry[];
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
  return (
    <table className="w-full table-fixed border-collapse text-ui">
      <thead className="sticky top-0 z-10 bg-background">
        <tr className="h-6 border-b border-border text-ui-xs text-muted-foreground">
          <Th label="이름" k="name" sort={p.sort} onSort={p.onSort} className="pl-3" />
          <Th label="수정일" k="mtime" sort={p.sort} onSort={p.onSort} className="w-44" />
          <Th label="크기" k="size" sort={p.sort} onSort={p.onSort} className="w-24 pr-3 text-right" />
        </tr>
      </thead>
      <tbody>
        {p.creatingFolder && (
          <tr className="h-7">
            <td className="pl-3" colSpan={3}>
              <span className="flex items-center gap-2">
                <Folder className="size-4 fill-primary/20 text-primary" />
                <InlineName initial="새 폴더" existing={p.existingNames} onSubmit={p.onCreateFolder} onCancel={p.onCreateFolderCancel} className="h-6 max-w-xs text-ui md:text-ui" />
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
                "h-7 cursor-default select-none",
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
                    <InlineName initial={e.name} existing={p.existingNames.filter((n) => n !== e.name)} onSubmit={(n) => p.onRenameSubmit(e, n)} onCancel={p.onRenameCancel} className="h-6 max-w-sm text-ui md:text-ui" />
                  ) : (
                    <span className="truncate">{e.name}</span>
                  )}
                </span>
              </td>
              <td className="text-muted-foreground">{formatDateLong(e.mtime)}</td>
              <td className="pr-3 text-right text-muted-foreground tabular-nums">{e.type === "file" ? formatSize(e.size) : ""}</td>
            </EntryContextMenu>
          );
        })}
      </tbody>
    </table>
  );
}

function Th({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: Sort; onSort(k: SortKey): void; className?: string }) {
  const active = sort.key === k;
  return (
    <th className={cn("cursor-default text-left font-normal select-none hover:bg-accent", className)} onClick={() => onSort(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (sort.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </span>
    </th>
  );
}

export function FileListSkeleton() {
  return (
    <div className="flex flex-col">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className={cn("h-7", i % 2 === 1 && "bg-muted/60")}>
          <div className="ml-3 mt-2 h-3 w-48 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
