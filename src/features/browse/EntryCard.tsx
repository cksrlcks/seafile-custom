import { File, FileText, Image } from "lucide-react";
import { cn } from "cn";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderGlyph } from "@/components/ui/folder-glyph";
import { formatDateLong, formatSize } from "@/lib/format";
import type { Entry } from "@/storage/StorageProvider";
import { InlineName } from "./InlineName";

export function FileIcon({ name, className }: { name: string; className?: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const cls = cn("size-4 text-muted-foreground", className);
  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(ext)) return <Image className={cls} />;
  if (["txt", "md", "json", "log"].includes(ext)) return <FileText className={cls} />;
  return <File className={cls} />;
}

interface Props {
  entry: Entry;
  checked: boolean;
  onToggle(): void;
  onOpen(): void;
  renaming: boolean;
  onRenameSubmit(name: string): void;
  onRenameCancel(): void;
}

/** 참고 시안의 카드: 흰 카드 안에 회색 영역 + 체크박스 + 아이콘, 아래 이름/메타 */
export function EntryCard({ entry, checked, onToggle, onOpen, renaming, onRenameSubmit, onRenameCancel }: Props) {
  return (
    <div
      className={cn(
        "group flex w-58 cursor-default flex-col gap-3 rounded-2xl border border-border bg-card p-2 pb-4 transition-shadow hover:shadow-lg",
        checked && "border-foreground/30 shadow-md",
      )}
      onDoubleClick={() => !renaming && onOpen()}
    >
      <div className="relative flex h-36 items-center justify-center rounded-xl bg-muted/60">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className={cn("absolute top-3 left-3 size-5 rounded-md border-border bg-card data-checked:border-foreground data-checked:bg-foreground", !checked && "opacity-0 group-hover:opacity-100")}
        />
        {entry.type === "dir" ? <FolderGlyph className="size-22" /> : <FileIcon name={entry.name} className="size-14" />}
      </div>
      {renaming ? (
        <InlineName initial={entry.name} onSubmit={onRenameSubmit} onCancel={onRenameCancel} className="mx-2 h-8 text-center text-sm" />
      ) : (
        <span className="w-full truncate px-2 text-center text-[15px] font-medium">{entry.name}</span>
      )}
      <span className="-mt-2 truncate text-center text-xs text-muted-foreground">
        {entry.type === "file" ? `${formatSize(entry.size)} · ` : ""}
        {formatDateLong(entry.mtime)}
      </span>
    </div>
  );
}
