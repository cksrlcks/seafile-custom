import { File, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderGlyph } from "@/components/ui/folder-glyph";
import { formatDate, formatSize } from "@/lib/format";
import type { Entry } from "@/storage/StorageProvider";
import { EntryContextMenu, type EntryMenuActions } from "./ContextMenu";
import { InlineName } from "./InlineName";

interface Props {
  entries: Entry[];
  onOpenDir(path: string): void;
  onOpenFile(entry: Entry): void;
  actions: EntryMenuActions;
  /** 이름 변경 중인 항목 경로 */
  renamingPath: string | null;
  onRenameSubmit(entry: Entry, newName: string): void;
  onRenameCancel(): void;
  /** 새 폴더 입력 행 표시 */
  creatingFolder: boolean;
  onCreateFolder(name: string): void;
  onCreateFolderCancel(): void;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const cls = "size-4 text-muted-foreground";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return <Image className={cls} />;
  if (["txt", "md", "json", "log"].includes(ext)) return <FileText className={cls} />;
  return <File className={cls} />;
}

/** 폴더는 카드, 파일은 테이블 (참고 시안 구조) */
export function FileTable(p: Props) {
  const dirs = p.entries.filter((e) => e.type === "dir");
  const files = p.entries.filter((e) => e.type === "file");
  const showDirs = dirs.length > 0 || p.creatingFolder;
  return (
    <div className="flex flex-col gap-8 p-6">
      {showDirs && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">
            폴더 <span className="font-normal text-muted-foreground">{dirs.length}</span>
          </h2>
          <div className="flex flex-wrap gap-4">
            {p.creatingFolder && (
              <div className="flex w-56 flex-col gap-3 rounded-2xl border border-dashed border-primary bg-card p-2 pb-4">
                <div className="flex h-36 items-center justify-center rounded-xl bg-muted/60">
                  <FolderGlyph className="size-20" />
                </div>
                <InlineName initial="새 폴더" onSubmit={p.onCreateFolder} onCancel={p.onCreateFolderCancel} className="mx-2 h-8 text-center text-sm" />
              </div>
            )}
            {dirs.map((d) => (
              <EntryContextMenu key={d.path} entry={d} actions={p.actions}>
                <Button
                  variant="ghost"
                  onDoubleClick={() => p.renamingPath !== d.path && p.onOpenDir(d.path)}
                  className="flex h-auto w-56 flex-col items-stretch gap-3 rounded-2xl border border-border bg-card p-2 pb-4 font-normal hover:bg-card hover:shadow-md"
                  title={d.name}
                >
                  <div className="flex h-36 items-center justify-center rounded-xl bg-muted/60">
                    <FolderGlyph className="size-20" />
                  </div>
                  {p.renamingPath === d.path ? (
                    <InlineName initial={d.name} onSubmit={(n) => p.onRenameSubmit(d, n)} onCancel={p.onRenameCancel} className="mx-2 h-8 text-center text-sm" />
                  ) : (
                    <span className="w-full truncate text-center text-sm font-medium">{d.name}</span>
                  )}
                  <span className="-mt-2 text-center text-xs text-muted-foreground">{formatDate(d.mtime).slice(0, 10)}</span>
                </Button>
              </EntryContextMenu>
            ))}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-semibold">
            파일 <span className="font-normal text-muted-foreground">{files.length}</span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="bg-muted/40 text-sm text-muted-foreground">
                <tr className="h-12 border-b border-border">
                  <th className="px-5 text-left font-normal">이름</th>
                  <th className="w-44 px-5 text-left font-normal">수정일</th>
                  <th className="w-28 px-5 text-right font-normal">크기</th>
                </tr>
              </thead>
              <tbody>
                {files.map((e) => (
                  <EntryContextMenu key={e.path} entry={e} actions={p.actions} asRow>
                    <td className="px-5" onDoubleClick={() => p.renamingPath !== e.path && p.onOpenFile(e)}>
                      <span className="flex items-center gap-3">
                        <FileIcon name={e.name} />
                        {p.renamingPath === e.path ? (
                          <InlineName initial={e.name} onSubmit={(n) => p.onRenameSubmit(e, n)} onCancel={p.onRenameCancel} className="h-7 max-w-md" />
                        ) : (
                          <span className="truncate">{e.name}</span>
                        )}
                      </span>
                    </td>
                    <td className="px-5 text-muted-foreground" onDoubleClick={() => p.onOpenFile(e)}>
                      {formatDate(e.mtime)}
                    </td>
                    <td className="px-5 text-right text-muted-foreground" onDoubleClick={() => p.onOpenFile(e)}>
                      {formatSize(e.size)}
                    </td>
                  </EntryContextMenu>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export function FileTableSkeleton() {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="h-4 w-16 animate-pulse rounded-md bg-muted" />
      <div className="flex gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 w-36 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
