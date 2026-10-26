import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderGlyph } from "@/components/ui/folder-glyph";
import { formatDateLong, formatSize } from "@/lib/format";
import type { Entry } from "@/storage/StorageProvider";
import { EntryContextMenu, type EntryMenuActions } from "./ContextMenu";
import { EntryCard, FileIcon } from "./EntryCard";
import { InlineName } from "./InlineName";

export type ViewMode = "list" | "grid";
export type SortKey = "name" | "mtime" | "size";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

interface Props {
  entries: Entry[];
  view: ViewMode;
  sort: Sort;
  onSort(key: SortKey): void;
  selected: Set<string>;
  onToggle(path: string): void;
  onToggleAll(paths: string[]): void;
  onOpenDir(path: string): void;
  onOpenFile(entry: Entry): void;
  actions: EntryMenuActions;
  renamingPath: string | null;
  onRenameSubmit(entry: Entry, newName: string): void;
  onRenameCancel(): void;
  creatingFolder: boolean;
  onCreateFolder(name: string): void;
  onCreateFolderCancel(): void;
}

export function sortEntries(list: Entry[], sort: Sort): Entry[] {
  const m = sort.dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (sort.key === "name") return a.name.localeCompare(b.name) * m;
    return (a[sort.key] - b[sort.key]) * m;
  });
}

export function FileTable(p: Props) {
  const dirs = sortEntries(p.entries.filter((e) => e.type === "dir"), { key: "name", dir: "asc" });
  const files = sortEntries(p.entries.filter((e) => e.type === "file"), p.sort);
  const showDirs = dirs.length > 0 || p.creatingFolder;

  const card = (e: Entry, open: () => void) => (
    <EntryContextMenu key={e.path} entry={e} actions={p.actions}>
      <EntryCard
        entry={e}
        checked={p.selected.has(e.path)}
        onToggle={() => p.onToggle(e.path)}
        onOpen={open}
        renaming={p.renamingPath === e.path}
        onRenameSubmit={(n) => p.onRenameSubmit(e, n)}
        onRenameCancel={p.onRenameCancel}
      />
    </EntryContextMenu>
  );

  return (
    <div className="flex flex-col gap-8 p-7">
      {showDirs && (
        <section className="flex flex-col gap-4">
          <SectionTitle label="폴더" count={dirs.length} />
          <div className="flex flex-wrap gap-5">
            {p.creatingFolder && (
              <div className="flex w-58 flex-col gap-3 rounded-2xl border border-dashed border-primary bg-card p-2 pb-4">
                <div className="flex h-36 items-center justify-center rounded-xl bg-muted/60">
                  <FolderGlyph className="size-22" />
                </div>
                <InlineName initial="새 폴더" onSubmit={p.onCreateFolder} onCancel={p.onCreateFolderCancel} className="mx-2 h-8 text-center text-sm" />
              </div>
            )}
            {dirs.map((d) => card(d, () => p.onOpenDir(d.path)))}
          </div>
        </section>
      )}

      {files.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionTitle label="파일" count={files.length} />
          {p.view === "grid" ? (
            <div className="flex flex-wrap gap-5">{files.map((f) => card(f, () => p.onOpenFile(f)))}</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <table className="w-full table-fixed border-collapse text-[15px]">
                <thead className="bg-muted/40 text-sm text-muted-foreground">
                  <tr className="h-13 border-b border-border">
                    <th className="w-14 pl-5">
                      <Checkbox
                        checked={files.length > 0 && files.every((f) => p.selected.has(f.path))}
                        indeterminate={files.some((f) => p.selected.has(f.path)) && !files.every((f) => p.selected.has(f.path))}
                        onCheckedChange={() => p.onToggleAll(files.map((f) => f.path))}
                        className="size-5 rounded-md data-checked:border-foreground data-checked:bg-foreground data-indeterminate:border-foreground data-indeterminate:bg-foreground data-indeterminate:text-background"
                      />
                    </th>
                    <SortHeader label="파일 이름" k="name" sort={p.sort} onSort={p.onSort} />
                    <SortHeader label="수정일" k="mtime" sort={p.sort} onSort={p.onSort} className="w-56" />
                    <SortHeader label="크기" k="size" sort={p.sort} onSort={p.onSort} className="w-32" />
                  </tr>
                </thead>
                <tbody>
                  {files.map((e) => (
                    <EntryContextMenu key={e.path} entry={e} actions={p.actions} asRow selected={p.selected.has(e.path)}>
                      <td className="pl-5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={p.selected.has(e.path)}
                          onCheckedChange={() => p.onToggle(e.path)}
                          className="size-5 rounded-md data-checked:border-foreground data-checked:bg-foreground"
                        />
                      </td>
                      <td className="px-2" onDoubleClick={() => p.renamingPath !== e.path && p.onOpenFile(e)}>
                        <span className="flex items-center gap-3">
                          <FileIcon name={e.name} />
                          {p.renamingPath === e.path ? (
                            <InlineName initial={e.name} onSubmit={(n) => p.onRenameSubmit(e, n)} onCancel={p.onRenameCancel} className="h-8 max-w-md" />
                          ) : (
                            <span className="truncate">{e.name}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-2 text-foreground/80" onDoubleClick={() => p.onOpenFile(e)}>
                        {formatDateLong(e.mtime)}
                      </td>
                      <td className="px-2 text-foreground/80" onDoubleClick={() => p.onOpenFile(e)}>
                        {formatSize(e.size)}
                      </td>
                    </EntryContextMenu>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SectionTitle({ label, count }: { label: string; count: number }) {
  return (
    <h2 className="text-lg font-semibold">
      {label} <span className="font-normal text-muted-foreground">{count}</span>
    </h2>
  );
}

function SortHeader({ label, k, sort, onSort, className }: { label: string; k: SortKey; sort: Sort; onSort(k: SortKey): void; className?: string }) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={cn("text-left font-normal", className)}>
      <Button variant="ghost" size="sm" onClick={() => onSort(k)} className={cn("-ml-2 gap-1.5 font-normal text-muted-foreground", active && "text-foreground")}>
        {label} <Icon className="size-3.5" />
      </Button>
    </th>
  );
}

export function FileTableSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-7">
      <div className="h-5 w-20 animate-pulse rounded-md bg-muted" />
      <div className="flex gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 w-58 animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
      <div className="mt-4 h-5 w-20 animate-pulse rounded-md bg-muted" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-12 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}
