import { ChevronDown, ChevronRight, Folder, FolderOpen, Lock, Pencil } from "lucide-react";
import { cn } from "cn";
import { useState, type ReactNode } from "react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import type { Library } from "@/storage/StorageProvider";
import { InlineName } from "./InlineName";
import { useCurrentDir, type Location } from "./useCurrentDir";

interface Props {
  libraries: Library[] | undefined;
  loc: Location;
  onNavigate(loc: Location): void;
  onRenameLibrary(lib: Library, newName: string): void;
}

/** macOS 소스 리스트 스타일: 연회색, 11px 섹션 라벨, 28px 행, 선택은 옅은 파란 틴트 */
export function Sidebar({ libraries, loc, onNavigate, onRenameLibrary }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const names = libraries?.map((l) => l.name) ?? [];
  return (
    <aside className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar px-2 pt-2 pb-2">
      <div className="mb-1 px-2 pt-1 text-ui-xs font-medium text-muted-foreground">내 저장소</div>
      {libraries?.map((lib) =>
        lib.encrypted ? (
          <Row key={lib.id} depth={0} icon={<Lock className="size-4" />} label={lib.name} disabled title="암호화된 저장소는 지원하지 않습니다" />
        ) : renamingId === lib.id ? (
          <div key={lib.id} className="my-px pl-6">
            <InlineName
              initial={lib.name}
              existing={names.filter((n) => n !== lib.name)}
              onSubmit={(n) => {
                setRenamingId(null);
                onRenameLibrary(lib, n);
              }}
              onCancel={() => setRenamingId(null)}
              className="h-7 text-ui md:text-ui"
            />
          </div>
        ) : (
          <ContextMenu key={lib.id}>
            <ContextMenuTrigger render={<div className="contents" />}>
              <LibraryNode lib={lib} loc={loc} onNavigate={onNavigate} />
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => setRenamingId(lib.id)} className="text-ui">
                <Pencil className="size-4" /> 이름 변경
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ),
      )}
    </aside>
  );
}

function LibraryNode({ lib, loc, onNavigate }: { lib: Library; loc: Location; onNavigate(loc: Location): void }) {
  const active = loc.libId === lib.id;
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? active;
  return (
    <>
      <Row
        depth={0}
        icon={expanded ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
        label={lib.name}
        selected={active && loc.path === "/"}
        chevron={expanded ? "down" : "right"}
        onChevron={() => setOpen(!expanded)}
        onClick={() => onNavigate({ libId: lib.id, path: "/" })}
      />
      {expanded && <DirChildren libId={lib.id} path="/" depth={1} loc={loc} onNavigate={onNavigate} />}
    </>
  );
}

function DirChildren({ libId, path, depth, loc, onNavigate }: { libId: string; path: string; depth: number; loc: Location; onNavigate(loc: Location): void }) {
  const q = useCurrentDir({ libId, path });
  const dirs = q.data?.filter((e) => e.type === "dir") ?? [];
  if (q.isLoading) return <div className="my-1 h-5 animate-pulse rounded bg-sidebar-accent" style={{ marginLeft: depth * 16 + 24 }} />;
  return (
    <>
      {dirs.map((d) => (
        <DirNode key={d.path} libId={libId} path={d.path} name={d.name} depth={depth} loc={loc} onNavigate={onNavigate} />
      ))}
    </>
  );
}

function DirNode({ libId, path, name, depth, loc, onNavigate }: { libId: string; path: string; name: string; depth: number; loc: Location; onNavigate(loc: Location): void }) {
  const selected = loc.libId === libId && loc.path === path;
  const ancestor = loc.libId === libId && loc.path.startsWith(path + "/");
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? ancestor;
  return (
    <>
      <Row depth={depth} icon={<Folder className="size-4" />} label={name} selected={selected} chevron={expanded ? "down" : "right"} onChevron={() => setOpen(!expanded)} onClick={() => onNavigate({ libId, path })} />
      {expanded && <DirChildren libId={libId} path={path} depth={depth + 1} loc={loc} onNavigate={onNavigate} />}
    </>
  );
}

function Row({ depth, icon, label, selected, disabled, title, chevron, onChevron, onClick }: { depth: number; icon: ReactNode; label: string; selected?: boolean; disabled?: boolean; title?: string; chevron?: "down" | "right"; onChevron?(): void; onClick?(): void }) {
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      title={title ?? label}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "my-px flex h-7 cursor-default items-center gap-1.5 rounded-md pr-2 text-ui text-foreground",
        !disabled && !selected && "hover:bg-sidebar-accent",
        selected && "bg-selection",
        disabled && "text-muted-foreground",
      )}
      style={{ paddingLeft: depth * 16 + 4 }}
    >
      <span
        className={cn("flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground", chevron && "hover:bg-accent")}
        onClick={(e) => {
          if (!chevron) return;
          e.stopPropagation();
          onChevron?.();
        }}
      >
        {chevron === "down" ? <ChevronDown className="size-3.5" /> : chevron === "right" ? <ChevronRight className="size-3.5" /> : null}
      </span>
      <span className={cn("shrink-0", selected ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
