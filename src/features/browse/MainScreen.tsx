import { useQueryClient } from "@tanstack/react-query";
import { LogOut, RefreshCw, Upload, User } from "lucide-react";
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
import { FileTable, FileTableSkeleton } from "./FileTable";
import { Sidebar } from "./Sidebar";
import { useCurrentDir, useLibraries, type Location } from "./useCurrentDir";

export function MainScreen() {
  const { session, logout } = useSession();
  const qc = useQueryClient();
  const [loc, setLoc] = useState<Location>({ libId: null, path: "/" });
  const libs = useLibraries();
  const dir = useCurrentDir(loc);
  const libName = libs.data?.find((l) => l.id === loc.libId)?.name;
  const dropRef = useRef<DropZoneHandle>(null);
  const title = loc.path === "/" ? libName : baseName(loc.path);
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

  function openFile(entry: Entry) {
    // Task 9/10에서 미리보기·다운로드로 연결
    console.log("open", entry.path);
  }

  return (
    <div className="flex h-screen flex-col bg-background p-3 text-foreground">
      <header className="flex h-10 shrink-0 items-center gap-2 px-2">
        <span className="text-sm font-semibold">seadrive</span>
        <div className="flex-1" />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
            <User className="size-4" />
            <span className="max-w-40 truncate text-xs">{session.connection.baseUrl.replace(/^https?:\/\//, "")}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={logout}>
              <LogOut className="size-4" /> 로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar libraries={libs.data} selected={loc.libId} onSelect={(libId) => setLoc({ libId, path: "/" })} />

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {libs.error && <ErrorBanner message="라이브러리 목록을 불러오지 못했습니다" onRetry={() => libs.refetch()} />}
          {loc.libId === null ? (
            <Empty text="라이브러리를 선택하세요" />
          ) : (
            <>
              <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
                <Breadcrumb libName={libName} path={loc.path} onNavigate={(path) => setLoc({ ...loc, path })} />
              </div>
              <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
                <h1 className="min-w-0 flex-1 truncate text-base font-semibold">{title}</h1>
                <Button variant="ghost" size="icon-sm" title="새로고침" onClick={() => qc.invalidateQueries({ queryKey: ["dir"] })}>
                  <RefreshCw className="size-4" />
                </Button>
                <Button size="sm" onClick={() => dropRef.current?.open()}>
                  <Upload className="size-4" /> 업로드
                </Button>
              </div>
              <div className="relative flex min-h-0 flex-1 flex-col overflow-auto bg-background/40">
                <DropZone targetDir={loc.path} onFiles={onFiles} handle={dropRef}>
                  {dir.error && <ErrorBanner message="폴더를 불러오지 못했습니다" onRetry={() => dir.refetch()} />}
                  {dir.isLoading ? (
                    <FileTableSkeleton />
                  ) : dir.data && dir.data.length === 0 ? (
                    <Empty text="파일을 끌어다 놓으세요" />
                  ) : dir.data ? (
                    <FileTable entries={dir.data} onOpenDir={(path) => setLoc({ ...loc, path })} onOpenFile={openFile} />
                  ) : null}
                </DropZone>
              </div>
            </>
          )}
        </main>
      </div>
      <UploadPanel />
      <OverwriteDialog count={pending?.conflicts.length ?? 0} onChoice={onOverwriteChoice} />
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
