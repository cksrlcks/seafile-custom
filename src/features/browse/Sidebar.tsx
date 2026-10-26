import { ChevronDown, ChevronRight, Folder, FolderOpen, Lock, PanelLeft } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { Pencil } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { InlineName } from "./InlineName";
import { StorageCard } from "./StorageCard";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/logo";
import type { Library } from "@/storage/StorageProvider";
import { useCurrentDir, type Location } from "./useCurrentDir";

interface Props {
  libraries: Library[] | undefined;
  loc: Location;
  onNavigate(loc: Location): void;
  onCollapse(): void;
  onRenameLibrary(lib: Library, newName: string): void;
}

/** 시안: 연회색(위가 살짝 밝은) 사이드바, 로고 18px, 섹션 라벨 15px 회색, 행 40px, 선택 행은 흰색+옅은 그림자 */
export function Sidebar({ libraries, loc, onNavigate, onCollapse, onRenameLibrary }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const names = libraries?.map((l) => l.name) ?? [];
  return (
    <aside className="flex w-80 shrink-0 flex-col gap-7 overflow-y-auto bg-linear-to-b from-sidebar to-sidebar-bottom px-6 pt-9 pb-6">
      <div className="flex h-8 items-center gap-2.5 px-1">
        <Logo />
        <span className="text-lg font-semibold tracking-tight">seadrive</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon-sm" onClick={onCollapse} title="사이드바 접기" className="text-muted-foreground hover:bg-sidebar-accent">
          <PanelLeft className="size-4.5" />
        </Button>
      </div>

      <section className="flex flex-col gap-0.5">
        <div className="mb-2 px-1 text-md text-muted-foreground">내 저장소</div>
        {libraries?.map((lib) =>
          lib.encrypted ? (
            <Row key={lib.id} depth={0} icon={<Lock className="size-4" />} label={lib.name} disabled title="암호화된 저장소는 지원하지 않습니다" />
          ) : renamingId === lib.id ? (
            <div key={lib.id} className="my-0.5 pl-3">
              <InlineName
                initial={lib.name}
                existing={names.filter((n) => n !== lib.name)}
                onSubmit={(n) => {
                  setRenamingId(null);
                  onRenameLibrary(lib, n);
                }}
                onCancel={() => setRenamingId(null)}
                className="h-9 text-md"
              />
            </div>
          ) : (
            <ContextMenu key={lib.id}>
              <ContextMenuTrigger render={<div className="contents" />}>
                <LibraryNode lib={lib} loc={loc} onNavigate={onNavigate} />
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem onClick={() => setRenamingId(lib.id)}>
                  <Pencil className="size-4" /> 이름 변경
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          ),
        )}
      </section>
      <div className="mt-auto">
        <StorageCard />
      </div>
    </aside>
  );
}

function LibraryNode({ lib, loc, onNavigate }: { lib: Library; loc: Location; onNavigate(loc: Location): void }) {
  const active = loc.libId === lib.id;
  const [open, setOpen] = useState<boolean | null>(null); // null = 사용자가 안 건드림 → 활성이면 펼침
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

/** 폴더 하위 목록. 본문과 같은 쿼리 키라 캐시를 공유한다. 시안의 세로 연결선 포함. */
function DirChildren({ libId, path, depth, loc, onNavigate }: { libId: string; path: string; depth: number; loc: Location; onNavigate(loc: Location): void }) {
  const q = useCurrentDir({ libId, path });
  const dirs = q.data?.filter((e) => e.type === "dir") ?? [];
  if (q.isLoading) return <div className="my-1 h-8 animate-pulse rounded-lg bg-sidebar-accent" style={{ marginLeft: depth * 20 + 8 }} />;
  if (dirs.length === 0) return null;
  return (
    <div className="relative">
      <span className="absolute top-1 bottom-2 w-px bg-foreground/12" style={{ left: depth * 20 - 2 }} />
      {dirs.map((d) => (
        <DirNode key={d.path} libId={libId} path={d.path} name={d.name} depth={depth} loc={loc} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function DirNode({ libId, path, name, depth, loc, onNavigate }: { libId: string; path: string; name: string; depth: number; loc: Location; onNavigate(loc: Location): void }) {
  const selected = loc.libId === libId && loc.path === path;
  const ancestor = loc.libId === libId && loc.path.startsWith(path + "/");
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? ancestor;
  return (
    <>
      <Row
        depth={depth}
        icon={<Folder className="size-4" />}
        label={name}
        selected={selected}
        chevron={expanded ? "down" : "right"}
        onChevron={() => setOpen(!expanded)}
        onClick={() => onNavigate({ libId, path })}
      />
      {expanded && <DirChildren libId={libId} path={path} depth={depth + 1} loc={loc} onNavigate={onNavigate} />}
    </>
  );
}

function Row({
  depth,
  icon,
  label,
  selected,
  disabled,
  title,
  chevron,
  onChevron,
  onClick,
}: {
  depth: number;
  icon: React.ReactNode;
  label: string;
  selected?: boolean;
  disabled?: boolean;
  title?: string;
  chevron?: "down" | "right";
  onChevron?(): void;
  onClick?(): void;
}) {
  return (
    <div className="relative my-0.5 flex items-center" style={{ paddingLeft: depth * 20 }}>
      {chevron && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute z-10 size-6 text-muted-foreground hover:bg-transparent"
          style={{ left: depth * 20 + 6 }}
          onClick={(e) => {
            e.stopPropagation();
            onChevron?.();
          }}
        >
          {chevron === "down" ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </Button>
      )}
      <Button
        variant="ghost"
        disabled={disabled}
        onClick={onClick}
        title={title ?? label}
        className={cn(
          "h-10 w-full justify-start gap-2.5 rounded-[10px] pr-3 text-md font-normal text-foreground hover:bg-sidebar-accent",
          chevron ? "pl-9" : "pl-3",
          selected && "bg-card font-medium shadow-item hover:bg-card",
          disabled && "text-muted-foreground",
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="truncate">{label}</span>
      </Button>
    </div>
  );
}
