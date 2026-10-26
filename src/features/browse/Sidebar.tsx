import { ChevronDown, ChevronRight, Folder, FolderOpen, Lock, PanelLeft, Waves } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Library } from "@/storage/StorageProvider";
import { useCurrentDir, type Location } from "./useCurrentDir";

interface Props {
  libraries: Library[] | undefined;
  loc: Location;
  onNavigate(loc: Location): void;
  onCollapse(): void;
}

export function Sidebar({ libraries, loc, onNavigate, onCollapse }: Props) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-6 overflow-y-auto px-5 py-5">
      <div className="flex h-9 items-center gap-2 px-1">
        <Waves className="size-7 text-primary" />
        <span className="text-xl font-semibold tracking-tight">seadrive</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon-sm" onClick={onCollapse} title="사이드바 접기" className="text-muted-foreground">
          <PanelLeft className="size-4" />
        </Button>
      </div>

      <section className="flex flex-col gap-1">
        <div className="mb-1 px-2 text-sm text-muted-foreground">라이브러리</div>
        {libraries?.map((lib) =>
          lib.encrypted ? (
            <Row key={lib.id} depth={0} icon={<Lock className="size-4" />} label={lib.name} disabled title="암호화 라이브러리는 지원하지 않습니다" />
          ) : (
            <LibraryNode key={lib.id} lib={lib} loc={loc} onNavigate={onNavigate} />
          ),
        )}
      </section>
    </aside>
  );
}

function LibraryNode({ lib, loc, onNavigate }: { lib: Library; loc: Location; onNavigate(loc: Location): void }) {
  const active = loc.libId === lib.id;
  const [open, setOpen] = useState(false);
  const expanded = open || active;
  return (
    <>
      <Row
        depth={0}
        icon={expanded ? <FolderOpen className="size-4" /> : <Folder className="size-4" />}
        label={lib.name}
        selected={active && loc.path === "/"}
        chevron={expanded ? "down" : "right"}
        onChevron={() => setOpen((v) => !v || !active)}
        onClick={() => onNavigate({ libId: lib.id, path: "/" })}
      />
      {expanded && <DirChildren libId={lib.id} path="/" depth={1} loc={loc} onNavigate={onNavigate} />}
    </>
  );
}

/** 폴더 하위 목록. 같은 쿼리 키를 쓰므로 본문과 캐시를 공유한다. */
function DirChildren({ libId, path, depth, loc, onNavigate }: { libId: string; path: string; depth: number; loc: Location; onNavigate(loc: Location): void }) {
  const q = useCurrentDir({ libId, path });
  const dirs = q.data?.filter((e) => e.type === "dir") ?? [];
  if (q.isLoading) return <div className="h-8 animate-pulse rounded-lg bg-muted/60" style={{ marginLeft: depth * 16 + 8 }} />;
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
  const [open, setOpen] = useState(false);
  const expanded = open || ancestor;
  return (
    <>
      <Row
        depth={depth}
        icon={<Folder className="size-4" />}
        label={name}
        selected={selected}
        chevron={expanded ? "down" : "right"}
        onChevron={() => setOpen((v) => !v)}
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
    <div className="relative flex items-center" style={{ paddingLeft: depth * 16 }}>
      {chevron && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="absolute z-10 size-6 text-muted-foreground"
          style={{ left: depth * 16 + 4 }}
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
          "h-10 w-full justify-start gap-2.5 rounded-xl pr-3 text-[15px] font-normal text-foreground/80 hover:bg-accent",
          chevron ? "pl-8" : "pl-3",
          selected && "bg-card font-medium text-foreground shadow-sm hover:bg-card",
          disabled && "text-muted-foreground",
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        <span className="truncate">{label}</span>
      </Button>
    </div>
  );
}
