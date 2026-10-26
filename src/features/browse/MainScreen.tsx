import { useQueryClient } from "@tanstack/react-query";
import { LogOut, RefreshCw, Upload, User } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useSession } from "@/storage/StorageContext";
import type { Entry, UploadTask } from "@/storage/StorageProvider";
import { DropZone, type DropZoneHandle } from "@/features/upload/DropZone";
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

  function onFiles(tasks: UploadTask[]) {
    // Task 8에서 업로드 큐로 연결
    console.log("drop", tasks);
  }

  function openFile(entry: Entry) {
    // Task 9/10에서 미리보기·다운로드로 연결
    console.log("open", entry.path);
  }

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
        <span className="text-sm font-semibold">seadrive</span>
        <span className="mx-2 h-4 w-px bg-border" />
        <div className="min-w-0 flex-1">
          {loc.libId && <Breadcrumb libName={libName} path={loc.path} onNavigate={(path) => setLoc({ ...loc, path })} />}
        </div>
        {loc.libId && (
          <Button variant="outline" size="sm" onClick={() => dropRef.current?.open()}>
            <Upload className="size-4" /> 업로드
          </Button>
        )}
        <Button variant="ghost" size="icon-sm" title="새로고침" onClick={() => qc.invalidateQueries({ queryKey: ["dir"] })}>
          <RefreshCw className="size-4" />
        </Button>
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
        <main className="relative flex min-w-0 flex-1 flex-col overflow-auto">
          <DropZone targetDir={loc.path} onFiles={onFiles} handle={dropRef}>
          {libs.error && <ErrorBanner message="라이브러리 목록을 불러오지 못했습니다" onRetry={() => libs.refetch()} />}
          {dir.error && <ErrorBanner message="폴더를 불러오지 못했습니다" onRetry={() => dir.refetch()} />}
          {loc.libId === null ? (
            <Empty text="라이브러리를 선택하세요" />
          ) : dir.isLoading ? (
            <FileTableSkeleton />
          ) : dir.data && dir.data.length === 0 ? (
            <Empty text="파일을 끌어다 놓으세요" />
          ) : dir.data ? (
            <FileTable entries={dir.data} onOpenDir={(path) => setLoc({ ...loc, path })} onOpenFile={openFile} />
          ) : null}
          </DropZone>
        </main>
      </div>
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
