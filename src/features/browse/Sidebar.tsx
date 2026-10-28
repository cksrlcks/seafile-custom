import { IconChevronDown, IconChevronRight, IconCloud, IconFolder, IconLink, IconLock, IconPencil, IconStar, IconStarOff, IconTrash } from "@tabler/icons-react";
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
  onStarLibrary(lib: Library, starred: boolean): void;
  onRenameFolder(libId: string, path: string, newName: string): void;
  width: number;
  /** 현재 저장소의 휴지통 열기 */
  onTrash(): void;
  /** 메인 영역에 무엇이 떠 있는지. 파일 탐색이 아니면 저장소 행을 선택 표시하지 않는다 */
  page: "files" | "links";
  onShareLinks(): void;
}

/** 이름 변경 중인 대상: 저장소는 "lib:<id>", 폴더는 "dir:<libId>:<path>" */
interface Ctx {
  loc: Location;
  onNavigate(loc: Location): void;
  renaming: string | null;
  setRenaming(key: string | null): void;
  onRenameFolder(libId: string, path: string, newName: string): void;
}

const COLLAPSED_KEY = "seadrive.sidebar.collapsed";

/** 접은 섹션 이름들. localStorage에 기억 */
function useCollapsed() {
  const [collapsed, setCollapsed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]") as string[];
    } catch {
      return [];
    }
  });
  const toggle = (s: string) =>
    setCollapsed((c) => {
      const next = c.includes(s) ? c.filter((x) => x !== s) : [...c, s];
      try {
        localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  return [collapsed, toggle] as const;
}

/** macOS 소스 리스트 스타일: 연회색, 11px 섹션 라벨, 28px 행, 선택은 옅은 파란 틴트 */
export function Sidebar({ libraries, loc, onNavigate, onRenameLibrary, onStarLibrary, onRenameFolder, width, onTrash, page, onShareLinks }: Props) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [collapsed, toggleSection] = useCollapsed();
  const names = libraries?.map((l) => l.name) ?? [];
  const ctx: Ctx = { loc, onNavigate, renaming, setRenaming, onRenameFolder };
  // 즐겨찾기 → 내 저장소 → 나에게 공유됨. 즐겨찾기한 저장소는 원래 섹션에도 그대로 둔다
  const sections = new Map<string, Library[]>([["즐겨찾기", []], ["내 저장소", []]]);
  for (const l of libraries ?? []) {
    for (const s of l.starred ? ["즐겨찾기", l.section] : [l.section]) sections.set(s, [...(sections.get(s) ?? []), l]);
  }
  // 같은 저장소가 두 섹션에 있으면 선택 표시·폴더 트리는 클릭한 쪽에만
  const [clickedIn, setClickedIn] = useState<string | null>(null);
  return (
    <aside style={{ width }} className="flex shrink-0 flex-col overflow-y-auto border-r border-border bg-sidebar px-2 pt-2 pb-2">
      {[...sections].filter(([, libs]) => libs.length > 0).map(([section, libs], i) => (
        <div key={section} className={cn(i > 0 && "mt-3")}>
          <button type="button" onClick={() => toggleSection(section)} className="group/sec mb-1 flex w-full items-center gap-1 px-2 pt-1 text-2xs font-medium text-muted-foreground">
            {section}
            <IconChevronDown className={cn("size-3 opacity-0 transition-transform group-hover/sec:opacity-100", collapsed.includes(section) && "-rotate-90 opacity-100")} />
          </button>
          {!collapsed.includes(section) && libs.map((lib) => {
            if (lib.encrypted) return <Row key={lib.id} root depth={0} icon={<IconLock className="size-4" />} label={lib.name} disabled title="암호화된 저장소는 지원하지 않습니다" />;
            const active = loc.libId === lib.id && (!lib.starred || (clickedIn ?? "즐겨찾기") === section);
            return (
              <div key={lib.id}>
                {renaming === `lib:${lib.id}` ? (
                  <div className="my-px pl-7">
                    <InlineName
                      initial={lib.name}
                      existing={names.filter((n) => n !== lib.name)}
                      onSubmit={(n) => {
                        setRenaming(null);
                        onRenameLibrary(lib, n);
                      }}
                      onCancel={() => setRenaming(null)}
                      className="h-7 text-sm md:text-sm"
                    />
                  </div>
                ) : (
                  <RowMenu onRename={lib.section === "내 저장소" ? () => setRenaming(`lib:${lib.id}`) : undefined} star={{ starred: !!lib.starred, onToggle: () => onStarLibrary(lib, !lib.starred) }}>
                    {/* 저장소 = 드라이브 루트. 접고 펼치지 않고, 선택된 저장소 아래에만 폴더 트리 */}
                    <Row root depth={0} icon={<IconCloud className="size-4" />} label={lib.name} selected={page === "files" && active && loc.path === "/"} onClick={() => {
                        setClickedIn(section);
                        onNavigate({ libId: lib.id, path: "/" });
                      }} />
                  </RowMenu>
                )}
                {active && <DirChildren libId={lib.id} path="/" depth={0} ctx={ctx} />}
              </div>
            );
          })}
        </div>
      ))}
      <div className="mt-auto border-t border-sidebar-border pt-2">
        <Row root depth={0} icon={<IconLink className="size-4" />} label="공유 링크" selected={page === "links"} onClick={onShareLinks} />
        <Row root depth={0} icon={<IconTrash className="size-4" />} label="휴지통" disabled={loc.libId === null} title={loc.libId === null ? "저장소를 먼저 선택하세요" : undefined} onClick={onTrash} />
      </div>
    </aside>
  );
}

/** 우클릭 → (저장소면 즐겨찾기) · 이름 변경(공유받은 저장소는 없음). 트리거는 이 행 하나만 감싼다(하위 폴더 행의 우클릭이 위로 새지 않게). */
function RowMenu({ onRename, star, children }: { onRename?(): void; star?: { starred: boolean; onToggle(): void }; children: ReactNode }) {
  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div />}>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        {star && (
          <ContextMenuItem onClick={star.onToggle} className="text-sm">
            {star.starred ? <IconStarOff className="size-4" /> : <IconStar className="size-4" />} {star.starred ? "즐겨찾기 해제" : "즐겨찾기에 추가"}
          </ContextMenuItem>
        )}
        {onRename && (
          <ContextMenuItem onClick={onRename} className="text-sm">
            <IconPencil className="size-4" /> 이름 변경
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

function DirChildren({ libId, path, depth, ctx }: { libId: string; path: string; depth: number; ctx: Ctx }) {
  const q = useCurrentDir({ libId, path });
  const dirs = q.data?.filter((e) => e.type === "dir") ?? [];
  if (q.isLoading) return <div className="my-1 h-5 animate-pulse rounded bg-sidebar-accent" style={{ marginLeft: depth * 16 + 32 }} />;
  const siblingNames = (q.data ?? []).map((e) => e.name);
  return (
    <>
      {dirs.map((d) => (
        <DirNode key={d.path} libId={libId} path={d.path} name={d.name} depth={depth} siblingNames={siblingNames} ctx={ctx} />
      ))}
    </>
  );
}

function DirNode({ libId, path, name, depth, siblingNames, ctx }: { libId: string; path: string; name: string; depth: number; siblingNames: string[]; ctx: Ctx }) {
  const { loc } = ctx;
  const selected = loc.libId === libId && loc.path === path;
  const ancestor = loc.libId === libId && loc.path.startsWith(path + "/");
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? ancestor;
  const key = `dir:${libId}:${path}`;
  return (
    <>
      {ctx.renaming === key ? (
        <div className="my-px" style={{ paddingLeft: depth * 16 + 38 }}>
          <InlineName
            initial={name}
            existing={siblingNames.filter((n) => n !== name)}
            onSubmit={(n) => {
              ctx.setRenaming(null);
              ctx.onRenameFolder(libId, path, n);
            }}
            onCancel={() => ctx.setRenaming(null)}
            className="h-7 text-sm md:text-sm"
          />
        </div>
      ) : (
        <RowMenu onRename={() => ctx.setRenaming(key)}>
          <Row depth={depth} icon={<IconFolder className="size-4" />} label={name} selected={selected} chevron={expanded ? "down" : "right"} onChevron={() => setOpen(!expanded)} onClick={() => ctx.onNavigate({ libId, path })} />
        </RowMenu>
      )}
      {expanded && <DirChildren libId={libId} path={path} depth={depth + 1} ctx={ctx} />}
    </>
  );
}

function Row({ root, depth, icon, label, selected, disabled, title, chevron, onChevron, onClick }: { root?: boolean; depth: number; icon: ReactNode; label: string; selected?: boolean; disabled?: boolean; title?: string; chevron?: "down" | "right"; onChevron?(): void; onClick?(): void }) {
  return (
    <div
      role="treeitem"
      aria-selected={selected}
      title={title ?? label}
      onClick={disabled ? undefined : onClick}
      className={cn(
        "my-px flex h-7 cursor-default items-center gap-1.5 rounded-md pr-2 text-sm text-foreground",
        root && "h-8 gap-2 font-medium",
        !disabled && !selected && "hover:bg-sidebar-accent",
        selected && "bg-selection",
        disabled && "text-muted-foreground",
      )}
      style={{ paddingLeft: root ? 8 : depth * 16 + 12 }}
    >
      {!root && (
        <span
          className={cn("flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground", chevron && "hover:bg-accent")}
          onClick={(e) => {
            if (!chevron) return;
            e.stopPropagation();
            onChevron?.();
          }}
        >
          {chevron === "down" ? <IconChevronDown className="size-3.5" /> : chevron === "right" ? <IconChevronRight className="size-3.5" /> : null}
        </span>
      )}
      <span className={cn("shrink-0", selected ? "text-primary" : "text-muted-foreground")}>{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}
