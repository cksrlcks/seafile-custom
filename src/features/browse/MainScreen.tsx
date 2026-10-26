import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PreviewModal } from "@/features/preview/PreviewModal";
import { previewKind } from "@/features/preview/previewKind";
import { ShareDialog } from "@/features/share/ShareDialog";
import { StatusBar } from "@/features/shell/StatusBar";
import { TitleBar, type Crumb } from "@/features/shell/TitleBar";
import { DropZone, type DropZoneHandle } from "@/features/upload/DropZone";
import { OverwriteDialog, type OverwriteChoice } from "@/features/upload/OverwriteDialog";
import { planUploads } from "@/features/upload/planUploads";
import { UploadPanel } from "@/features/upload/UploadPanel";
import { useUploadQueue } from "@/features/upload/useUploadQueue";
import { useSession, useStorage } from "@/storage/StorageContext";
import { parentPath, splitPath } from "@/storage/path";
import type { Entry, Library, UploadTask } from "@/storage/StorageProvider";
import type { EntryMenuActions } from "./ContextMenu";
import { DeleteDialog } from "./DeleteDialog";
import { FileList, FileListSkeleton, orderEntries, type Sort, type SortKey, type ViewMode } from "./FileList";
import { IconGrid } from "./IconGrid";
import { Sidebar } from "./Sidebar";
import { useCurrentDir, useLibraries, type Location } from "./useCurrentDir";
import { useEntryActions } from "./useEntryActions";

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
  const entries = useMemo(() => {
    const list = dir.data ?? [];
    const f = filter.trim().toLowerCase();
    return orderEntries(f ? list.filter((e) => e.name.toLowerCase().includes(f)) : list, sort);
  }, [dir.data, filter, sort]);
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
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deleting, setDeleting] = useState<Entry[]>([]);
  const [sharing, setSharing] = useState<Entry | null>(null);
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const previewable = entries.filter((e) => e.type === "file" && previewKind(e.name) !== null);
  const previewIndex = previewable.findIndex((e) => e.path === previewPath);

  function open(entry: Entry) {
    if (entry.type === "dir") setLoc({ ...loc, path: entry.path });
    else if (previewKind(entry.name)) setPreviewPath(entry.path);
    else ops.download.mutate(entry);
  }
  const menuActions: EntryMenuActions = {
    onOpen: open,
    onDownload: (e) => ops.download.mutate(e),
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
  }

  const listProps = {
    entries,
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

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-ui text-foreground">
      <TitleBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        canBack={canBack}
        canForward={canForward}
        onBack={() => go(-1)}
        onForward={() => go(1)}
        crumbs={crumbs}
        onNavigate={(path) => setLoc({ ...loc, path })}
        filter={filter}
        onFilter={setFilter}
        view={view}
        onView={setView}
        onRefresh={() => void qc.invalidateQueries({ queryKey: ["dir"] })}
        onNewFolder={() => setCreatingFolder(true)}
        onUpload={() => dropRef.current?.open()}
        accountLabel={session.connection.baseUrl.replace(/^https?:\/\//, "")}
        onLogout={logout}
        disabled={!loc.libId}
      />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && <Sidebar libraries={libs.data} loc={loc} onNavigate={setLoc} onRenameLibrary={(lib, newName) => renameLibrary.mutate({ lib, newName })} />}

        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {libs.error && <ErrorBanner message="저장소 목록을 불러오지 못했습니다" onRetry={() => libs.refetch()} />}
          {renameLibrary.error && <ErrorBanner message={`저장소 이름을 바꾸지 못했습니다 (${(renameLibrary.error as Error).message})`} actionLabel="닫기" onRetry={() => renameLibrary.reset()} />}
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
              ) : dir.isLoading ? (
                <FileListSkeleton />
              ) : entries.length === 0 && !creatingFolder ? (
                <Empty text={filter ? "일치하는 항목이 없습니다" : "비어 있는 폴더입니다. 파일을 끌어다 놓으세요"} />
              ) : view === "grid" ? (
                <IconGrid {...listProps} />
              ) : (
                <FileList {...listProps} />
              )}
            </div>
          </DropZone>
          <UploadPanel />
        </main>
      </div>

      <StatusBar itemCount={dir.data ? dir.data.length : null} selectedCount={selectedEntries.length} selectedBytes={selectedEntries.reduce((a, e) => a + e.size, 0)} />

      {loc.libId && (
        <PreviewModal libId={loc.libId} entries={previewable} index={previewIndex} onClose={() => setPreviewPath(null)} onNavigate={(i) => setPreviewPath(previewable[i]?.path ?? null)} onDownload={(e) => ops.download.mutate(e)} />
      )}
      {loc.libId && <ShareDialog libId={loc.libId} entry={sharing} onClose={() => setSharing(null)} />}
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
  return <div className="flex h-full items-center justify-center text-ui text-muted-foreground">{text}</div>;
}

function ErrorBanner({ message, onRetry, actionLabel = "다시 시도" }: { message: string; onRetry(): void; actionLabel?: string }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-3 py-1.5 text-ui text-destructive">
      <span className="truncate">{message}</span>
      <Button variant="outline" size="xs" onClick={onRetry}>
        {actionLabel}
      </Button>
    </div>
  );
}
