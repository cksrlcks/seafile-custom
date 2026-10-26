import { cn } from "cn";
import { FolderGlyph } from "@/components/ui/folder-glyph";
import { EntryContextMenu } from "./ContextMenu";
import { EntryIcon, type ListProps } from "./FileList";
import { InlineName } from "./InlineName";

/** 아이콘 보기: 96px 셀, 64px 아이콘, 12px 두 줄 라벨 */
export function IconGrid(p: ListProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-1 p-3">
      {p.creatingFolder && (
        <div className="flex flex-col items-center gap-1 rounded-md p-2">
          <FolderGlyph className="size-16" />
          <InlineName initial="새 폴더" existing={p.existingNames} onSubmit={p.onCreateFolder} onCancel={p.onCreateFolderCancel} className="h-6 text-center text-xs md:text-xs" />
        </div>
      )}
      {p.entries.map((e) => {
        const sel = p.selected.has(e.path);
        return (
          <EntryContextMenu
            key={e.path}
            entry={e}
            actions={p.actions}
            dataPath={e.path}
            className={cn(
              "flex cursor-default flex-col items-center gap-1 rounded-md p-2 select-none",
              sel ? "bg-selection" : "hover:bg-accent/60",
              p.focusPath === e.path && "outline-1 -outline-offset-1 outline-primary/60",
            )}
            onClick={(ev) => p.onSelect(e, ev)}
            onDoubleClick={() => p.renamingPath !== e.path && p.onOpen(e)}
            onContextMenu={() => !sel && p.onSelect(e, { ctrlKey: false, metaKey: false, shiftKey: false } as React.MouseEvent)}
          >
            <div className="flex h-16 items-center justify-center">{e.type === "dir" ? <FolderGlyph className="size-16" /> : <EntryIcon entry={e} className="size-12" />}</div>
            {p.renamingPath === e.path ? (
              <InlineName initial={e.name} existing={p.existingNames.filter((n) => n !== e.name)} onSubmit={(n) => p.onRenameSubmit(e, n)} onCancel={p.onRenameCancel} className="h-6 text-center text-xs md:text-xs" />
            ) : (
              <span className="line-clamp-2 w-full text-center text-xs leading-tight break-all" title={e.name}>
                {e.name}
              </span>
            )}
          </EntryContextMenu>
        );
      })}
    </div>
  );
}
