import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileStack, FolderPlus, LayoutGrid, List, LogOut, PanelLeft, RefreshCw, Trash2, Upload, User } from "lucide-react";
import { cn } from "cn";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { DropZone, type DropZoneHandle } from "@/features/upload/DropZone";
import { OverwriteDialog, type OverwriteChoice } from "@/features/upload/OverwriteDialog";
import { planUploads } from "@/features/upload/planUploads";
import { UploadPanel } from "@/features/upload/UploadPanel";
import { useUploadQueue } from "@/features/upload/useUploadQueue";
import { PreviewModal } from "@/features/preview/PreviewModal";
import { previewKind } from "@/features/preview/previewKind";
import { ShareDialog } from "@/features/share/ShareDialog";
import { useSession, useStorage } from "@/storage/StorageContext";
import { baseName } from "@/storage/path";
import type { Entry, Library, UploadTask } from "@/storage/StorageProvider";
import { Breadcrumb } from "./Breadcrumb";
import type { EntryMenuActions } from "./ContextMenu";
import { DeleteDialog } from "./DeleteDialog";
import { FileTable, FileTableSkeleton, type Sort, type SortKey, type ViewMode } from "./FileTable";
import { Sidebar } from "./Sidebar";
import { useCurrentDir, useLibraries, type Location } from "./useCurrentDir";
import { useEntryActions } from "./useEntryActions";

export function MainScreen() {
  const { session, logout } = useSession();
  const storage = useStorage();
  const qc = useQueryClient();
  const renameLibrary = useMutation({
    mutationFn: ({ lib, newName }: { lib: Library; newName: string }) => storage.renameLibrary(lib.id, newName),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["libraries"] }),
  });
  const [loc, setLocState] = useState<Location>({ libId: null, path: "/" });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [view, setView] = useState<ViewMode>("list");
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const libs = useLibraries();
  const dir = useCurrentDir(loc);
  const libName = libs.data?.find((l) => l.id === loc.libId)?.name;
  const dropRef = useRef<DropZoneHandle>(null);
  const title = loc.path === "/" ? libName : baseName(loc.path);

  function setLoc(next: Location) {
    setLocState(next);
    setSelected(new Set());
    setRenamingPath(null);
    setCreatingFolder(false);
  }

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

  const ops = useEntryActions(loc);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deleting, setDeleting] = useState<Entry[]>([]);
  const [sharing, setSharing] = useState<Entry | null>(null);
  const menuActions: EntryMenuActions = {
    onDownload: (e) => ops.download.mutate(e),
    onRename: (e) => setRenamingPath(e.path),
    onShare: (e) => setSharing(e),
    onDelete: (e) => setDeleting([e]),
  };

  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const previewable = (dir.data ?? []).filter((e) => e.type === "file" && previewKind(e.name) !== null);
  const previewIndex = previewable.findIndex((e) => e.path === previewPath);

  function openFile(entry: Entry) {
    if (previewKind(entry.name)) setPreviewPath(entry.path);
    else ops.download.mutate(entry);
  }

  function toggle(path: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(path)) n.delete(path);
      else n.add(path);
      return n;
    });
  }
  function toggleAll(paths: string[]) {
    setSelected((s) => {
      const n = new Set(s);
      if (paths.every((p) => n.has(p))) paths.forEach((p) => n.delete(p));
      else paths.forEach((p) => n.add(p));
      return n;
    });
  }
  function onSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }
  const selectedEntries = (dir.data ?? []).filter((e) => selected.has(e.path));

  return (
    <div className="flex h-screen bg-background text-foreground">
      {sidebarOpen && (
        <Sidebar
          libraries={libs.data}
          loc={loc}
          onNavigate={setLoc}
          onCollapse={() => setSidebarOpen(false)}
          onRenameLibrary={(lib, newName) => renameLibrary.mutate({ lib, newName })}
        />
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
          {libs.error && <ErrorBanner message="라이브러리 목록을 불러오지 못했습니다" onRetry={() => libs.refetch()} />}
          {renameLibrary.error && <ErrorBanner message={`라이브러리 이름을 바꾸지 못했습니다 (${(renameLibrary.error as Error).message})`} actionLabel="닫기" onRetry={() => renameLibrary.reset()} />}

          {/* 시안 실측: 브레드크럼 바 84px, 15px 회색, 문서 아이콘 */}
          <div className="flex h-21 shrink-0 items-center gap-2.5 border-b border-border px-7">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(true)} title="사이드바 펼치기" className="-ml-2 text-muted-foreground">
                <PanelLeft className="size-4.5" />
              </Button>
            )}
            <FileStack className="size-4.5 text-muted-foreground" />
            {loc.libId ? (
              <Breadcrumb libName={libName} path={loc.path} onNavigate={(path) => setLoc({ ...loc, path })} />
            ) : (
              <span className="text-md text-muted-foreground">라이브러리</span>
            )}
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
                <User className="size-4" />
                <span className="max-w-48 truncate text-caption">{session.connection.baseUrl.replace(/^https?:\/\//, "")}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="size-4" /> 로그아웃
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {loc.libId === null ? (
            <Empty text="라이브러리를 선택하세요" />
          ) : (
            <>
              {/* 시안 실측: 제목 바 66px, 제목 20px, 세로 구분선, 활성 항목만 연회색 칩(44px, r=10) */}
              <div className="flex h-17 shrink-0 items-center gap-4 border-b border-border px-7">
                <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight">{title}</h1>
                <span className="h-5.5 w-px bg-border" />
                <div className="flex items-center gap-1">
                  <Button variant="ghost" onClick={() => setView("list")} className={cn("h-11 gap-2 rounded-[10px] px-4 text-md font-normal text-muted-foreground hover:bg-secondary", view === "list" && "bg-secondary text-foreground")}>
                    <List className="size-4.5" /> 목록
                  </Button>
                  <Button variant="ghost" onClick={() => setView("grid")} className={cn("h-11 gap-2 rounded-[10px] px-4 text-md font-normal text-muted-foreground hover:bg-secondary", view === "grid" && "bg-secondary text-foreground")}>
                    <LayoutGrid className="size-4.5" /> 그리드
                  </Button>
                </div>
                <div className="flex-1" />
                {selectedEntries.length > 0 && (
                  <>
                    <span className="text-md text-muted-foreground">{selectedEntries.length}개 선택</span>
                    <Button variant="outline" className="h-10 rounded-[10px] text-md font-normal" onClick={() => setDeleting(selectedEntries)}>
                      <Trash2 className="size-4" /> 삭제
                    </Button>
                    <span className="h-5.5 w-px bg-border" />
                  </>
                )}
                <Button variant="ghost" size="icon" title="새로고침" className="rounded-[10px] text-muted-foreground" onClick={() => qc.invalidateQueries({ queryKey: ["dir"] })}>
                  <RefreshCw className="size-4.5" />
                </Button>
                <Button variant="outline" className="h-10 rounded-[10px] text-md font-normal" onClick={() => setCreatingFolder(true)}>
                  <FolderPlus className="size-4.5" /> 새 폴더
                </Button>
                <Button className="h-10 rounded-[10px] text-md" onClick={() => dropRef.current?.open()}>
                  <Upload className="size-4.5" /> 업로드
                </Button>
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col overflow-auto">
                <DropZone targetDir={loc.path} onFiles={onFiles} handle={dropRef}>
                  {dir.error && <ErrorBanner message="폴더를 불러오지 못했습니다" onRetry={() => dir.refetch()} />}
                  {ops.error && <ErrorBanner message={`${ops.error.message} (${ops.error.detail})`} actionLabel="닫기" onRetry={ops.error.reset} />}
                  {dir.isLoading ? (
                    <FileTableSkeleton />
                  ) : dir.data && dir.data.length === 0 && !creatingFolder ? (
                    <Empty text="파일을 끌어다 놓으세요" />
                  ) : dir.data ? (
                    <FileTable
                      entries={dir.data}
                      view={view}
                      sort={sort}
                      onSort={onSort}
                      selected={selected}
                      onToggle={toggle}
                      onToggleAll={toggleAll}
                      onOpenDir={(path) => setLoc({ ...loc, path })}
                      onOpenFile={openFile}
                      actions={menuActions}
                      existingNames={(dir.data ?? []).map((e) => e.name)}
                      renamingPath={renamingPath}
                      onRenameSubmit={(entry, newName) => {
                        setRenamingPath(null);
                        ops.rename.mutate({ entry, newName });
                      }}
                      onRenameCancel={() => setRenamingPath(null)}
                      creatingFolder={creatingFolder}
                      onCreateFolder={(name) => {
                        setCreatingFolder(false);
                        ops.mkdir.mutate(name);
                      }}
                      onCreateFolderCancel={() => setCreatingFolder(false)}
                    />
                  ) : null}
                </DropZone>
              </div>
            </>
          )}
        </main>
        <UploadPanel />
      </div>

      {loc.libId && (
        <PreviewModal
          libId={loc.libId}
          entries={previewable}
          index={previewIndex}
          onClose={() => setPreviewPath(null)}
          onNavigate={(i) => setPreviewPath(previewable[i]?.path ?? null)}
          onDownload={(e) => ops.download.mutate(e)}
        />
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
  return <div className="flex flex-1 items-center justify-center text-md text-muted-foreground">{text}</div>;
}

function ErrorBanner({ message, onRetry, actionLabel = "다시 시도" }: { message: string; onRetry(): void; actionLabel?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-6 py-2.5 text-sm text-destructive">
      <span className="truncate">{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        {actionLabel}
      </Button>
    </div>
  );
}
