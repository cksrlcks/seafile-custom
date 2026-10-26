import { useQueryClient } from "@tanstack/react-query";
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
import { useSession } from "@/storage/StorageContext";
import { baseName } from "@/storage/path";
import type { Entry, UploadTask } from "@/storage/StorageProvider";
import { Breadcrumb } from "./Breadcrumb";
import type { EntryMenuActions } from "./ContextMenu";
import { DeleteDialog } from "./DeleteDialog";
import { FileTable, FileTableSkeleton, type Sort, type SortKey, type ViewMode } from "./FileTable";
import { Sidebar } from "./Sidebar";
import { useCurrentDir, useLibraries, type Location } from "./useCurrentDir";
import { useEntryActions } from "./useEntryActions";

export function MainScreen() {
  const { session, logout } = useSession();
  const qc = useQueryClient();
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
  const menuActions: EntryMenuActions = {
    onDownload: (e) => ops.download.mutate(e),
    onRename: (e) => setRenamingPath(e.path),
    onDelete: (e) => setDeleting([e]),
  };

  function openFile(entry: Entry) {
    // Task 10에서 미리보기로 연결. 지금은 다운로드.
    ops.download.mutate(entry);
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
    setSelected((s) => (paths.every((p) => s.has(p)) ? new Set() : new Set(paths)));
  }
  function onSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }
  const selectedEntries = (dir.data ?? []).filter((e) => selected.has(e.path));

  return (
    <div className="flex h-screen bg-background text-foreground">
      {sidebarOpen && <Sidebar libraries={libs.data} loc={loc} onNavigate={setLoc} onCollapse={() => setSidebarOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col py-3 pr-3 pl-0">
        <main className={cn("flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm", !sidebarOpen && "ml-3")}>
          {libs.error && <ErrorBanner message="라이브러리 목록을 불러오지 못했습니다" onRetry={() => libs.refetch()} />}

          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-6">
            {!sidebarOpen && (
              <Button variant="ghost" size="icon-sm" onClick={() => setSidebarOpen(true)} title="사이드바 펼치기" className="-ml-2 text-muted-foreground">
                <PanelLeft className="size-4" />
              </Button>
            )}
            <FileStack className="size-4 text-muted-foreground" />
            {loc.libId ? (
              <Breadcrumb libName={libName} path={loc.path} onNavigate={(path) => setLoc({ ...loc, path })} />
            ) : (
              <span className="text-sm text-muted-foreground">라이브러리</span>
            )}
            <div className="flex-1" />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="text-muted-foreground" />}>
                <User className="size-4" />
                <span className="max-w-48 truncate text-xs">{session.connection.baseUrl.replace(/^https?:\/\//, "")}</span>
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
              <div className="flex h-16 shrink-0 items-center gap-4 border-b border-border px-6">
                <h1 className="min-w-0 truncate text-xl font-semibold">{title}</h1>
                <span className="h-6 w-px bg-border" />
                <div className="flex items-center gap-1 rounded-xl bg-muted/60 p-1">
                  <Button variant="ghost" size="sm" onClick={() => setView("list")} className={cn("rounded-lg font-normal text-muted-foreground", view === "list" && "bg-card text-foreground shadow-sm hover:bg-card")}>
                    <List className="size-4" /> 목록
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setView("grid")} className={cn("rounded-lg font-normal text-muted-foreground", view === "grid" && "bg-card text-foreground shadow-sm hover:bg-card")}>
                    <LayoutGrid className="size-4" /> 그리드
                  </Button>
                </div>
                <div className="flex-1" />
                {selectedEntries.length > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selectedEntries.length}개 선택</span>
                    <Button variant="outline" size="sm" onClick={() => setDeleting(selectedEntries)}>
                      <Trash2 className="size-4" /> 삭제
                    </Button>
                    <span className="h-6 w-px bg-border" />
                  </>
                )}
                <Button variant="ghost" size="icon-sm" title="새로고침" className="text-muted-foreground" onClick={() => qc.invalidateQueries({ queryKey: ["dir"] })}>
                  <RefreshCw className="size-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCreatingFolder(true)}>
                  <FolderPlus className="size-4" /> 새 폴더
                </Button>
                <Button size="sm" onClick={() => dropRef.current?.open()}>
                  <Upload className="size-4" /> 업로드
                </Button>
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col overflow-auto">
                <DropZone targetDir={loc.path} onFiles={onFiles} handle={dropRef}>
                  {dir.error && <ErrorBanner message="폴더를 불러오지 못했습니다" onRetry={() => dir.refetch()} />}
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
  return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">{text}</div>;
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry(): void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
      <span>{message}</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        다시 시도
      </Button>
    </div>
  );
}
