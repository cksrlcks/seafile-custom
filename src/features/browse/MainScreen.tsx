import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PreviewModal } from "@/features/preview/PreviewModal";
import { previewKind } from "@/features/preview/previewKind";
import { ShareDialog } from "@/features/share/ShareDialog";
import { SettingsDialog } from "@/features/settings/SettingsDialog";
import { StatusBar } from "@/features/shell/StatusBar";
import { TitleBar, type Crumb } from "@/features/shell/TitleBar";
import { DropZone, type DropZoneHandle } from "@/features/upload/DropZone";
import { OverwriteDialog, type OverwriteChoice } from "@/features/upload/OverwriteDialog";
import { planUploads } from "@/features/upload/planUploads";
import { UploadPanel } from "@/features/upload/UploadPanel";
import { DownloadPanel } from "@/features/download/DownloadPanel";
import { useUploadQueue } from "@/features/upload/useUploadQueue";
import { useSession, useStorage } from "@/storage/StorageContext";
import { joinPath, parentPath, splitPath } from "@/storage/path";
import type { Entry, Library, UploadTask } from "@/storage/StorageProvider";
import type { EntryMenuActions } from "./ContextMenu";
import { DeleteDialog } from "./DeleteDialog";
import { FileList, FileListSkeleton, orderEntries, type Sort, type SortKey, type ViewMode } from "./FileList";
import { IconGrid } from "./IconGrid";
import { Sidebar } from "./Sidebar";
import { useCurrentDir, useLibraries, type Location } from "./useCurrentDir";
import { useEntryActions } from "./useEntryActions";
import { useRecursiveSearch } from "@/features/search/useRecursiveSearch";

export function MainScreen() {
  const { session, logout } = useSession();
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
    setSelected(new Set());
    setFocusPath(null);
    setRenamingPath(null);
    setCreatingFolder(false);
    setFilter("");
  }, []);
  const canBack = history.index > 0;
  const canForward = history.index < history.stack.length - 1;
  const go = (delta: number) => {
    setHistory((h) => ({ ...h, index: Math.max(0, Math.min(h.stack.length - 1, h.index + delta)) }));
    setSelected(new Set());
  };

  useEffect(() => {
    if (loc.libId !== null || !libs.data) return;
    const first = libs.data.find((l) => !l.encrypted);
    if (first) setHistory({ stack: [{ libId: first.id, path: "/" }], index: 0 });
  }, [libs.data, loc.libId]);

  const dir = useCurrentDir(loc);
  const lib = libs.data?.find((l) => l.id === loc.libId);
  const crumbs: Crumb[] = useMemo(() => {
    if (!lib) return [];
    const segs = splitPath(loc.path);
    return [{ label: lib.name, path: "/" }, ...segs.map((s, i) => ({ label: s, path: "/" + segs.slice(0, i + 1).join("/") }))];
  }, [lib, loc.path]);

  // ---- 보기·정렬·필터 ----
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });
  const [filter, setFilter] = useState("");
  // 검색어가 있으면 현재 폴더와 하위 폴더 전체에서 이름으로 찾는다
  const search = useRecursiveSearch(loc.libId, loc.path, filter);
  const searching = filter.trim() !== "";
  const entries = useMemo(() => orderEntries(searching ? search.results : (dir.data ?? []), sort), [searching, search.results, dir.data, sort]);
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
  const renameFolder = useMutation({
    mutationFn: ({ libId, path, newName }: { libId: string; path: string; newName: string }) => storage.rename(libId, path, newName, "dir"),
    onSuccess: (_d, { libId, path }) => qc.invalidateQueries({ queryKey: ["dir", libId, parentPath(path)] }),
  });
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deleting, setDeleting] = useState<Entry[]>([]);
  const [sharing, setSharing] = useState<Entry | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
    onRename: (e) => setRenamingPath(e.path),
    onShare: (e) => setSharing(e),
    onDelete: (e) => setDeleting(selected.has(e.path) && selectedEntries.length > 1 ? selectedEntries : [e]),
  };

  // ---- 키보드 ----
  const listRef = useRef<HTMLDivElement>(null);
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
    else if (e.key === "F2" && focusPath) (e.preventDefault(), setRenamingPath(focusPath));
    else if (e.key === "Delete" && selectedEntries.length) (e.preventDefault(), setDeleting(selectedEntries));
    else if (e.key === "Escape") setSelected(new Set());
    else if (mod && e.key.toLowerCase() === "a") (e.preventDefault(), setSelected(new Set(entries.map((x) => x.path))));
    else if (e.altKey && e.key === "ArrowLeft") (e.preventDefault(), go(-1));
    else if (e.altKey && e.key === "ArrowRight") (e.preventDefault(), go(1));
    else if (e.key === "F5") (e.preventDefault(), void qc.invalidateQueries({ queryKey: ["dir"] }));
    else if (mod && e.shiftKey && e.key.toLowerCase() === "n") (e.preventDefault(), setCreatingFolder(true));
    else if (mod && e.key === ",") (e.preventDefault(), setSettingsOpen(true));
  }

  const listProps = {
    entries,
    sort,
    onSort,
    locationRoot: searching ? loc.path : null,
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-sm text-foreground">
      <TitleBar
        menu={{
          newFolder: () => setCreatingFolder(true),
          upload: () => dropRef.current?.open(),
          selection: { count: selectedEntries.length, hasFile: selectedEntries.some((e) => e.type === "file") },
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
        }}
        crumbs={crumbs}
        onNavigate={(path) => setLoc({ ...loc, path })}
        filter={filter}
        onFilter={setFilter}
        accountLabel={session.connection.baseUrl.replace(/^https?:\/\//, "")}
        disabled={!loc.libId}
      />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <Sidebar
            libraries={libs.data}
            loc={loc}
            onNavigate={setLoc}
            onRenameLibrary={(lib, newName) => renameLibrary.mutate({ lib, newName })}
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
        )}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {libs.error && <ErrorBanner message="저장소 목록을 불러오지 못했습니다" onRetry={() => libs.refetch()} />}
          {renameLibrary.error && <ErrorBanner message={`저장소 이름을 바꾸지 못했습니다 (${(renameLibrary.error as Error).message})`} actionLabel="닫기" onRetry={() => renameLibrary.reset()} />}
          {renameFolder.error && <ErrorBanner message={`폴더 이름을 바꾸지 못했습니다 (${(renameFolder.error as Error).message})`} actionLabel="닫기" onRetry={() => renameFolder.reset()} />}
          {dir.error && <ErrorBanner message="폴더를 불러오지 못했습니다" onRetry={() => dir.refetch()} />}
          {ops.error && <ErrorBanner message={`${ops.error.message} (${ops.error.detail})`} actionLabel="닫기" onRetry={ops.error.reset} />}

          <DropZone targetDir={loc.path} onFiles={onFiles} handle={dropRef}>
            <div
              ref={listRef}
              tabIndex={0}
              onKeyDown={onKeyDown}
              onClick={(e) => e.target === e.currentTarget && setSelected(new Set())}
              className="min-h-0 flex-1 overflow-auto outline-none"
            >
              {loc.libId === null ? (
                <Empty text="왼쪽에서 저장소를 선택하세요" />
              ) : dir.isLoading && !searching ? (
                <FileListSkeleton />
              ) : entries.length === 0 && !creatingFolder ? (
                <Empty text={searching ? (search.done ? `'${filter.trim()}'와 일치하는 항목이 없습니다` : "검색 중…") : "비어 있는 폴더입니다. 파일을 끌어다 놓으세요"} />
              ) : view === "grid" ? (
                <IconGrid {...listProps} />
              ) : (
                <FileList {...listProps} />
              )}
            </div>
          </DropZone>
          <div className="pointer-events-none absolute right-3 bottom-3 z-20 flex flex-col items-end gap-2 *:pointer-events-auto">
            <DownloadPanel />
            <UploadPanel />
          </div>
        </main>
      </div>

      <StatusBar
        itemCount={searching ? null : dir.data ? dir.data.length : null}
        note={searching ? `검색 결과 ${search.results.length}개 · 폴더 ${search.scanned}개 확인${search.done ? "" : " 중…"}${search.truncated ? " (폴더가 많아 일부만 검색)" : ""}` : undefined}
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
