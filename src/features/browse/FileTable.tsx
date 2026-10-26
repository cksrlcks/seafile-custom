import { File, FileText, Folder, Image } from "lucide-react";
import { formatDate, formatSize } from "@/lib/format";
import type { Entry } from "@/storage/StorageProvider";

interface Props {
  entries: Entry[];
  onOpenDir(path: string): void;
  onOpenFile(entry: Entry): void;
}

function Icon({ entry }: { entry: Entry }) {
  if (entry.type === "dir") return <Folder className="size-4 text-muted-foreground" />;
  const ext = entry.name.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return <Image className="size-4 text-muted-foreground" />;
  if (["txt", "md", "json", "log"].includes(ext)) return <FileText className="size-4 text-muted-foreground" />;
  return <File className="size-4 text-muted-foreground" />;
}

export function FileTable({ entries, onOpenDir, onOpenFile }: Props) {
  return (
    <table className="w-full table-fixed border-collapse text-sm">
      <thead className="sticky top-0 bg-background text-xs text-muted-foreground">
        <tr className="h-8 border-b border-border">
          <th className="px-2 text-left font-medium">이름</th>
          <th className="w-24 px-2 text-right font-medium">크기</th>
          <th className="w-36 px-2 text-left font-medium">수정일</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((e) => (
          <tr
            key={e.path}
            className="h-8 cursor-default select-none border-b border-border/50 hover:bg-accent"
            onDoubleClick={() => (e.type === "dir" ? onOpenDir(e.path) : onOpenFile(e))}
          >
            <td className="px-2">
              <span className="flex items-center gap-2">
                <Icon entry={e} />
                <span className="truncate">{e.name}</span>
              </span>
            </td>
            <td className="px-2 text-right text-muted-foreground">{e.type === "file" ? formatSize(e.size) : ""}</td>
            <td className="px-2 text-muted-foreground">{formatDate(e.mtime)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function FileTableSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
      ))}
    </div>
  );
}
