import { File, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderGlyph } from "@/components/ui/folder-glyph";
import { formatDate, formatSize } from "@/lib/format";
import type { Entry } from "@/storage/StorageProvider";

interface Props {
  entries: Entry[];
  onOpenDir(path: string): void;
  onOpenFile(entry: Entry): void;
}

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const cls = "size-4 text-muted-foreground";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return <Image className={cls} />;
  if (["txt", "md", "json", "log"].includes(ext)) return <FileText className={cls} />;
  return <File className={cls} />;
}

/** 폴더는 카드, 파일은 테이블 (참고 시안 구조) */
export function FileTable({ entries, onOpenDir, onOpenFile }: Props) {
  const dirs = entries.filter((e) => e.type === "dir");
  const files = entries.filter((e) => e.type === "file");
  return (
    <div className="flex flex-col gap-6 p-4">
      {dirs.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            폴더 <span className="text-muted-foreground">{dirs.length}</span>
          </h2>
          <div className="flex flex-wrap gap-3">
            {dirs.map((d) => (
              <Button
                key={d.path}
                variant="ghost"
                onDoubleClick={() => onOpenDir(d.path)}
                className="flex h-auto w-36 flex-col items-center gap-2 rounded-xl border border-border bg-card p-3 font-normal shadow-sm hover:bg-accent"
                title={d.name}
              >
                <FolderGlyph />
                <span className="w-full truncate text-center text-sm">{d.name}</span>
                <span className="text-xs text-muted-foreground">{formatDate(d.mtime).slice(0, 10)}</span>
              </Button>
            ))}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium">
            파일 <span className="text-muted-foreground">{files.length}</span>
          </h2>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full table-fixed border-collapse text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr className="h-9 border-b border-border">
                  <th className="px-4 text-left font-medium">이름</th>
                  <th className="w-24 px-4 text-right font-medium">크기</th>
                  <th className="w-40 px-4 text-left font-medium">수정일</th>
                </tr>
              </thead>
              <tbody>
                {files.map((e) => (
                  <tr key={e.path} className="h-10 cursor-default select-none border-b border-border/60 last:border-0 hover:bg-accent/60" onDoubleClick={() => onOpenFile(e)}>
                    <td className="px-4">
                      <span className="flex items-center gap-2">
                        <FileIcon name={e.name} />
                        <span className="truncate">{e.name}</span>
                      </span>
                    </td>
                    <td className="px-4 text-right text-muted-foreground">{formatSize(e.size)}</td>
                    <td className="px-4 text-muted-foreground">{formatDate(e.mtime)}</td>
                  </tr>
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
