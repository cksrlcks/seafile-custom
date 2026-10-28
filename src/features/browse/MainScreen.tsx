import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PreviewModal } from "@/features/preview/PreviewModal";
import { previewKind } from "@/features/preview/previewKind";
import { ShareDialog } from "@/features/share/ShareDialog";
import { ShareLinksPage } from "@/features/share/ShareLinksPage";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { TrashPage } from "@/features/trash/TrashPage";
import { checkForUpdate } from "@/features/shell/updater";
import { UpdateNotice } from "@/features/shell/UpdateNotice";
import { StatusBar } from "@/features/shell/StatusBar";
import { isTauri } from "@/features/shell/platform";
import { TitleBar, type Crumb } from "@/features/shell/TitleBar";
import { DropZone, type DropZoneHandle } from "@/features/upload/DropZone";
import { OverwriteDialog, type OverwriteChoice } from "@/features/upload/OverwriteDialog";
import { planUploads } from "@/features/upload/planUploads";
import { UploadPanel } from "@/features/upload/UploadPanel";
import { DownloadPanel } from "@/features/download/DownloadPanel";
import { useUploadQueue } from "@/features/upload/useUploadQueue";
import { useSession, useStorage } from "@/storage/StorageContext";
import { useMarquee } from "./useMarquee";
import { FileSelectionBar } from "./SelectionBar";
import { useSidebarWidth } from "./useSidebarWidth";
import { joinPath, parentPath, splitPath } from "@/storage/path";
import type { Entry, Library, UploadTask } from "@/storage/StorageProvider";
import type { EntryMenuActions } from "./ContextMenu";
import { DeleteDialog } from "./DeleteDialog";
import { BackgroundContextMenu } from "./BackgroundContextMenu";
import { FileList, FileListSkeleton, orderEntries, type Sort, type SortKey, type ViewMode } from "./FileList";
import { IconGrid } from "./IconGrid";
import { Sidebar } from "./Sidebar";
import { useCurrentDir, useLibraries, type Location } from "./useCurrentDir";
import { useEntryActions } from "./useEntryActions";

export function MainScreen() {
  const { logout } = useSession();
  const storage = useStorage();
  const qc = useQueryClient();
  const libs = useLibraries();

  // ---- 위치 + 뒤로/앞으로 히스토리 ----
  const [history, setHistory] = useState<{ stack: Location[]; index: number }>({ stack: [{ libId: null, path: "/" }], index: 0 });
  const loc = history.stack[history.index];
  const setLoc = useCallback((next: Location) => {
    setHistory((h) => {
      const cur = h.stack[h.index];
      if (cur.libId === next.libId && cur.path === next.path) return h;
      const stack = [...h.stack.slice(0, h.index + 1), next];
      return { stack, index: stack.length - 1 };
    });
    setPage("files");
    setSelected(new Set());
    setFocusPath(null);
    setRenamingPath(null);
    setCreatingFolder(false);
  }, []);
  const canBack = history.index > 0;
  const canForward = history.index < history.stack.length - 1;
  const go = (delta: number) => {
    setHistory((h) => ({ ...h, index: Math.max(0, Math.min(h.stack.length - 1, h.index + delta)) }));
    setPage("files");
    setSelected(new Set());
  };

  useEffect(() => {
    if (loc.libId !== null || !libs.data) return;
    const first = libs.data.find((l) => !l.encrypted);
    if (first) setHistory({ stack: [{ libId: first.id, path: "/" }], index: 0 });
  }, [libs.data, loc.libId]);

  const dir = useCurrentDir(loc);
  const lib = libs.data?.find((l) => l.id === loc.libId);
  const readOnly = !!lib?.readOnly;
  const crumbs: Crumb[] = useMemo(() => {
    if (!lib) return [];
    const segs = splitPath(loc.path);
    return [{ label: lib.name, path: "/" }, ...segs.map((s, i) => ({ label: s, path: "/" + segs.slice(0, i + 1).join("/") }))];
  }, [lib, loc.path]);

  // ---- 보기·정렬·필터 ----
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sidebar = useSidebarWidth();
  const [view, setView] = useState<ViewMode>("list");
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });
  const entries = useMemo(() => orderEntries(dir.data ?? [], sort), [dir.data, sort]);
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  // ---- 선택 (클릭 / Ctrl / Shift / 키보드) ----
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusPath, setFocusPath] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const select = (entry: Entry, e: { ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }) => {
    const multi = e.ctrlKey || e.metaKey;
    setSelected((s) => {
      if (e.shiftKey && anchor.current) {
        const a = entries.findIndex((x) => x.path === anchor.current);
        const b = entries.findIndex((x) => x.path === entry.path);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const range = entries.slice(lo, hi + 1).map((x) => x.path);
        return new Set(multi ? [...s, ...range] : range);
      }
      if (multi) {
        const n = new Set(s);
        if (n.has(entry.path)) n.delete(entry.path);
        else n.add(entry.path);
        return n;
      }
      return new Set([entry.path]);
    });
    if (!e.shiftKey) anchor.current = entry.path;
    setFocusPath(entry.path);
  };
  const selectedEntries = entries.filter((e) => selected.has(e.path));

  // ---- 업로드 ----
  const dropRef = useRef<DropZoneHandle>(null);
  const { queue } = useUploadQueue();
  const [pending, setPending] = useState<{ conflicts: UploadTask[]; fresh: UploadTask[] } | null>(null);
  function onFiles(tasks: UploadTask[]) {
    if (!loc.libId) return;
    const plan = planUploads(tasks, dir.data ?? []);
    if (plan.conflicts.length === 0) queue.add(loc.libId, plan.fresh);
    else setPending(plan);
  }
  function onOverwriteChoice(c: OverwriteChoice) {
    if (pending && loc.libId) {
      if (c === "overwrite") queue.add(loc.libId, [...pending.fresh, ...pending.conflicts]);
      else if (c === "skip") queue.add(loc.libId, pending.fresh);
    }
    setPending(null);
  }

  // ---- 파일 조작 ----
  const ops = useEntryActions(loc);
  const renameLibrary = useMutation({
    mutationFn: ({ lib, newName }: { lib: Library; newName: string }) => storage.renameLibrary(lib.id, newName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
  const starLibrary = useMutation({
    mutationFn: ({ lib, starred }: { lib: Library; starred: boolean }) => storage.starLibrary(lib.id, starred),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
  const renameFolder = useMutation({
    mutationFn: ({ libId, path, newName }: { libId: string; path: string; newName: string }) => storage.rename(libId, path, newName, "dir"),
    onSuccess: (_d, { libId, path }) => qc.invalidateQueries({ queryKey: ["dir", libId, parentPath(path)] }),
  });
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deleting, setDeleting] = useState<Entry[]>([]);
  const [sharing, setSharing] = useState<Entry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** 메인 영역: 파일 탐색 · 공유 링크 · 휴지통 페이지. 어디로든 이동하면 파일 탐색으로 돌아온다 */
  const [page, setPage] = useState<"files" | "links" | "trash">("files");
  const openTrash = () => {
    setPage("trash");
    setSelected(new Set());
  };
  useEffect(() => void checkForUpdate(), []); // 시작할 때 한 번 조용히 확인
  const openLinks = () => {
    setPage("links");
    setSelected(new Set());
  };
  // 파일 목록의 공유 표시와 상태바 "링크 N개"용. 공유 링크 페이지와 같은 쿼리 키라 캐시를 같이 쓴다
  const shareLinks = useQuery({ queryKey: ["share-links"], queryFn: () => storage.listShareLinks() });
  const sharedPaths = useMemo(() => new Set((shareLinks.data ?? []).filter((l) => l.libId === loc.libId).map((l) => l.path)), [shareLinks.data, loc.libId]);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const previewable = entries.filter((e) => e.type === "file" && previewKind(e.name) !== null);
  const previewIndex = previewable.findIndex((e) => e.path === previewPath);

  function open(entry: Entry) {
    if (entry.type === "dir") setLoc({ ...loc, path: entry.path });
    else if (previewKind(entry.name)) setPreviewPath(entry.path);
    else ops.download.mutate([entry]);
  }
  const menuActions: EntryMenuActions = {
    onOpen: open,
    onDownload: (e) => ops.download.mutate(selected.has(e.path) && selectedEntries.length > 1 ? selectedEntries : [e]),
    onRename: readOnly ? undefined : (e) => setRenamingPath(e.path),
    onShare: (e) => setSharing(e),
    onDelete: readOnly ? undefined : (e) => setDeleting(selected.has(e.path) && selectedEntries.length > 1 ? selectedEntries : [e]),
  };

  // ---- 키보드 ----
  const listRef = useRef<HTMLDivElement>(null);
  const marquee = useMarquee(listRef, selected, setSelected);
  function onKeyDown(e: React.KeyboardEvent) {
    if (renamingPath || creatingFolder || (e.target as HTMLElement).tagName === "INPUT") return;
    const idx = entries.findIndex((x) => x.path === focusPath);
    const moveTo = (i: number) => {
      const t = entries[Math.max(0, Math.min(entries.length - 1, i))];
      if (!t) return;
      if (e.shiftKey) select(t, { ctrlKey: false, metaKey: false, shiftKey: true });
      else select(t, { ctrlKey: false, metaKey: false, shiftKey: false });
      listRef.current?.querySelector<HTMLElement>(`[data-path="${CSS.escape(t.path)}"]`)?.scrollIntoView({ block: "nearest" });
    };
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "ArrowDown") (e.preventDefault(), moveTo(idx + 1));
    else if (e.key === "ArrowUp") (e.preventDefault(), moveTo(idx - 1));
    else if (e.key === "Home") (e.preventDefault(), moveTo(0));
    else if (e.key === "End") (e.preventDefault(), moveTo(entries.length - 1));
    else if (e.key === "Enter" && focusPath) (e.preventDefault(), open(entries[idx]));
    else if (e.key === "Backspace" && loc.path !== "/") (e.preventDefault(), setLoc({ ...loc, path: parentPath(loc.path) }));
    else if (e.key === "F2" && focusPath && !readOnly) (e.preventDefault(), setRenamingPath(focusPath));
    else if (e.key === "Delete" && selectedEntries.length && !readOnly) (e.preventDefault(), setDeleting(selectedEntries));
    else if (e.key === "Escape") setSelected(new Set());
    else if (mod && e.key.toLowerCase() === "a") (e.preventDefault(), setSelected(new Set(entries.map((x) => x.path))));
    else if (e.altKey && e.key === "ArrowLeft") (e.preventDefault(), go(-1));
    else if (e.altKey && e.key === "ArrowRight") (e.preventDefault(), go(1));
    else if (e.key === "F5") (e.preventDefault(), void qc.invalidateQueries({ queryKey: ["dir"] }));
    else if (mod && e.shiftKey && e.key.toLowerCase() === "n" && !readOnly) (e.preventDefault(), setCreatingFolder(true));
    else if (mod && e.key === ",") (e.preventDefault(), setSettingsOpen(true));
  }

  const listProps = {
    entries,
    sharedPaths,
    sort,
    onSort,
    selected,
    focusPath,
    onSelect: select,
    onOpen: open,
    actions: menuActions,
    existingNames: (dir.data ?? []).map((e) => e.name),
    renamingPath,
    onRenameSubmit: (entry: Entry, newName: string) => {
      setRenamingPath(null);
      ops.rename.mutate({ entry, newName });
    },
    onRenameCancel: () => setRenamingPath(null),
    creatingFolder,
    onCreateFolder: (name: string) => {
      setCreatingFolder(false);
      ops.mkdir.mutate(name);
    },
    onCreateFolderCancel: () => setCreatingFolder(false),
  };

  // 트레이 메뉴(Rust)에서 넘어오는 동작
  useEffect(() => {
    if (!isTauri()) return;
    const actions: Record<string, () => void> = {
      upload: () => dropRef.current?.open(),
      refresh: () => void qc.invalidateQueries({ queryKey: ["dir"] }),
      settings: () => setSettingsOpen(true),
      logout,
    };
    const off = import("@tauri-apps/api/event").then(({ listen }) => listen<string>("tray", (e) => actions[e.payload]?.()));
    return () => void off.then((f) => f());
  }, [qc, logout]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-sm text-foreground">
      <TitleBar
        menu={{
          newFolder: () => setCreatingFolder(true),
          upload: () => dropRef.current?.open(),
          selection: { count: selectedEntries.length, hasFile: selectedEntries.some((e) => e.type === "file") },
          readOnly,
          download: () => ops.download.mutate(selectedEntries),
          share: () => selectedEntries[0] && setSharing(selectedEntries[0]),
          rename: () => selectedEntries[0] && setRenamingPath(selectedEntries[0].path),
          remove: () => setDeleting(selectedEntries),
          selectAll: () => setSelected(new Set(entries.map((x) => x.path))),
          clearSelection: () => setSelected(new Set()),
          view,
          setView,
          sidebarOpen,
          toggleSidebar: () => setSidebarOpen((v) => !v),
          refresh: () => void qc.invalidateQueries({ queryKey: ["dir"] }),
          sort,
          setSort,
          back: () => go(-1),
          forward: () => go(1),
          up: () => setLoc({ ...loc, path: parentPath(loc.path) }),
          canBack,
          canForward,
          canUp: loc.libId !== null && loc.path !== "/",
          logout,
          settings: () => setSettingsOpen(true),
          trash: openTrash,
          shareLinks: openLinks,
        }}
        crumbs={page === "links" ? [{ label: "공유 링크", path: loc.path }] : page === "trash" ? [{ label: `${lib?.name ?? ""} 휴지통`, path: loc.path }] : crumbs}
        onNavigate={(path) => setLoc({ ...loc, path })}
        onSearchPick={(libId, e) => {
          // 폴더는 안으로, 파일은 그 폴더로 가서 해당 파일을 선택
          if (e.type === "dir") setLoc({ libId, path: e.path });
          else {
            setLoc({ libId, path: parentPath(e.path) });
            setSelected(new Set([e.path]));
            setFocusPath(e.path);
          }
        }}
        disabled={!loc.libId || page !== "files"}
      />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <>
            <Sidebar
              width={sidebar.width}
              onTrash={openTrash}
              page={page}
              onShareLinks={openLinks}
              libraries={libs.data}
              loc={loc}
              onNavigate={setLoc}
              onRenameLibrary={(lib, newName) => renameLibrary.mutate({ lib, newName })}
              onStarLibrary={(lib, starred) => starLibrary.mutate({ lib, starred })}
              onRenameFolder={(libId, path, newName) =>
                renameFolder.mutate({ libId, path, newName }, {
                  onSuccess: () => {
                    // 보고 있던 위치가 이름 바뀐 폴더 안이면 새 경로로 옮긴다
                    if (loc.libId === libId && (loc.path === path || loc.path.startsWith(path + "/"))) {
                      setLoc({ libId, path: joinPath(parentPath(path), newName) + loc.path.slice(path.length) });
                    }
                  },
                })
              }
            />
            {/* 사이드바 오른쪽 경계 위 4px 끌기 영역. 표 머리글의 열 조절과 같은 모양 */}
            <div role="separator" aria-orientation="vertical" onPointerDown={sidebar.startResize} className="group relative z-10 -ml-1 w-1 shrink-0 cursor-col-resize">
              <div className="absolute inset-y-0 right-0 w-px group-hover:bg-primary group-active:bg-primary" />
            </div>
          </>
        )}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {libs.error && <ErrorBanner message="저장소 목록을 불러오지 못했습니다" onRetry={() => libs.refetch()} />}
          {renameLibrary.error && <ErrorBanner message={`저장소 이름을 바꾸지 못했습니다 (${(renameLibrary.error as Error).message})`} actionLabel="닫기" onRetry={() => renameLibrary.reset()} />}
          {renameFolder.error && <ErrorBanner message={`폴더 이름을 바꾸지 못했습니다 (${(renameFolder.error as Error).message})`} actionLabel="닫기" onRetry={() => renameFolder.reset()} />}
          {dir.error && <ErrorBanner message="폴더를 불러오지 못했습니다" onRetry={() => dir.refetch()} />}
          {ops.error && <ErrorBanner message={`${ops.error.message} (${ops.error.detail})`} actionLabel="닫기" onRetry={ops.error.reset} />}

          {page === "links" ? (
            <ShareLinksPage />
          ) : page === "trash" && loc.libId ? (
            <TrashPage libId={loc.libId} readOnly={readOnly} />
          ) : (
            <>
          <DropZone targetDir={loc.path} onFiles={onFiles} handle={dropRef} disabled={readOnly}>
            <BackgroundContextMenu
              disabled={loc.libId === null || creatingFolder || renamingPath !== null}
              onOpen={() => setSelected(new Set())}
              actions={{
                newFolder: () => setCreatingFolder(true),
                upload: () => dropRef.current?.open(),
                selectAll: () => setSelected(new Set(entries.map((x) => x.path))),
                refresh: () => void qc.invalidateQueries({ queryKey: ["dir"] }),
                view,
                setView,
                sort,
                setSort,
                readOnly,
              }}
              trigger={
                <div
                  ref={listRef}
                  tabIndex={0}
                  onKeyDown={onKeyDown}
                  onPointerDown={marquee.onPointerDown}
                  onClickCapture={marquee.onClickCapture}
                  onClick={(e) => e.target === e.currentTarget && setSelected(new Set())}
                  className="relative min-h-0 flex-1 overflow-auto outline-none"
                />
              }
            >
              {loc.libId === null ? (
                <Empty text="왼쪽에서 저장소를 선택하세요" />
              ) : dir.isLoading ? (
                <FileListSkeleton />
              ) : entries.length === 0 && !creatingFolder ? (
                <Empty text={readOnly ? "비어 있는 폴더입니다" : "비어 있는 폴더입니다. 파일을 끌어다 놓으세요"} />
              ) : view === "grid" ? (
                <IconGrid {...listProps} />
              ) : (
                <FileList {...listProps} />
              )}
              {marquee.rect && <div className="pointer-events-none absolute border border-primary/60 bg-primary/10" style={marquee.rect} />}
            </BackgroundContextMenu>
          </DropZone>
          <FileSelectionBar
            count={selectedEntries.length}
            hasFile={selectedEntries.some((e) => e.type === "file")}
            onDownload={() => ops.download.mutate(selectedEntries)}
            onShare={() => selectedEntries[0] && setSharing(selectedEntries[0])}
            onRename={() => selectedEntries[0] && setRenamingPath(selectedEntries[0].path)}
            onDelete={() => setDeleting(selectedEntries)}
            onClear={() => setSelected(new Set())}
            readOnly={readOnly}
          />
            </>
          )}
          <div className="pointer-events-none absolute right-3 bottom-3 z-20 flex flex-col items-end gap-2 *:pointer-events-auto">
            <UpdateNotice />
            <DownloadPanel />
            <UploadPanel />
          </div>
        </main>
      </div>

      <StatusBar
        itemCount={page === "files" && dir.data ? dir.data.length : null}
        note={page === "links" ? (shareLinks.data ? `링크 ${shareLinks.data.length}개` : "") : readOnly && dir.data ? `${dir.data.length}개 항목 · 읽기 전용` : undefined}
        selectedCount={selectedEntries.length}
        selectedBytes={selectedEntries.reduce((a, e) => a + e.size, 0)}
      />

      {loc.libId && (
        <PreviewModal libId={loc.libId} entries={previewable} index={previewIndex} onClose={() => setPreviewPath(null)} onNavigate={(i) => setPreviewPath(previewable[i]?.path ?? null)} onDownload={(e) => ops.download.mutate([e])} />
      )}
      {loc.libId && <ShareDialog libId={loc.libId} entry={sharing} onClose={() => setSharing(null)} />}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <OverwriteDialog count={pending?.conflicts.length ?? 0} onChoice={onOverwriteChoice} />
      <DeleteDialog
        entries={deleting}
        onCancel={() => setDeleting([])}
        onConfirm={() => {
          for (const e of deleting) ops.remove.mutate(e);
          setDeleting([]);
          setSelected(new Set());
        }}
      />
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">{text}</div>;
}

function ErrorBanner({ message, onRetry, actionLabel = "다시 시도" }: { message: string; onRetry(): void; actionLabel?: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-sm text-destructive">
      <span className="truncate">{message}</span>
      <Button variant="outline" size="xs" onClick={onRetry}>
        {actionLabel}
      </Button>
    </div>
  );
}
