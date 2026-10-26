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
  existingNames: string[];
  onRenameSubmit(name: string): void;
  onRenameCancel(): void;
}

/**
 * 시안 실측: 232×222 카드. 평소엔 테두리·그림자 없음(흰 바탕과 동화). 안쪽 회색 영역 136px, inset 8px, r=12.
 * 체크박스(18px, 흰색)는 항상 보임. 호버 시에만 1px 테두리 + 크고 부드러운 그림자.
 */
export function EntryCard({ entry, checked, onToggle, onOpen, renaming, existingNames, onRenameSubmit, onRenameCancel }: Props) {
  return (
    <div
      className={cn(
        "flex w-58 cursor-default flex-col rounded-2xl border border-transparent bg-card p-2 pb-5 transition-[box-shadow,border-color] duration-200 hover:border-border hover:shadow-float",
        checked && "border-border shadow-float",
      )}
      onDoubleClick={() => !renaming && onOpen()}
    >
      <div className="relative flex h-34 items-center justify-center rounded-xl bg-muted">
        <Checkbox
          checked={checked}
          onCheckedChange={onToggle}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="absolute top-2 left-2 size-4.5 rounded-[5px] border-input bg-card shadow-item data-checked:border-foreground data-checked:bg-foreground"
        />
        {entry.type === "dir" ? <FolderGlyph className="size-24" /> : <FileIcon name={entry.name} className="size-14 text-foreground/40" />}
      </div>
      <div className="mt-5 flex flex-col items-center gap-1 px-2">
        {renaming ? (
          <InlineName initial={entry.name} existing={existingNames} onSubmit={onRenameSubmit} onCancel={onRenameCancel} className="h-8 text-center text-md" />
        ) : (
          <span className="w-full truncate text-center text-md font-semibold">{entry.name}</span>
        )}
        <span className="truncate text-caption text-muted-foreground">
          {entry.type === "file" && (
            <>
              {formatSize(entry.size)}
              <span className="mx-1.5">•</span>
            </>
          )}
          {formatDateLong(entry.mtime)}
        </span>
      </div>
    </div>
  );
}
