import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconRestore, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntryIcon } from "@/features/browse/FileList";
import { formatDateLong, formatSize } from "@/lib/format";
import { useStorage } from "@/storage/StorageContext";
import { joinPath } from "@/storage/path";
import type { TrashEntry } from "@/storage/StorageProvider";

type Props = { libId: string | null; open: boolean; onClose(): void };

/** 현재 저장소의 휴지통. 복구하면 원래 폴더로 돌아간다. 항목별 영구 삭제는 서버가 지원하지 않아 전체 비우기만 있다. */
export function TrashDialog({ libId, open, onClose }: Props) {
  return (
    <Dialog open={open && libId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">{libId && <Body libId={libId} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ libId, onClose }: { libId: string; onClose(): void }) {
  const storage = useStorage();
  const qc = useQueryClient();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const trash = useQuery({ queryKey: ["trash", libId], queryFn: () => storage.listTrash(libId) });
  const changed = () => {
    void qc.invalidateQueries({ queryKey: ["trash", libId] });
    void qc.invalidateQueries({ queryKey: ["dir", libId] });
    void qc.invalidateQueries({ queryKey: ["account"] });
    void qc.invalidateQueries({ queryKey: ["libraries"] });
  };
  const restore = useMutation({ mutationFn: (e: TrashEntry) => storage.restoreTrash(libId, e), onSuccess: changed });
  const empty = useMutation({
    mutationFn: () => storage.emptyTrash(libId),
    onSuccess: () => {
      setConfirmEmpty(false);
      changed();
    },
  });
  const items = trash.data ?? [];
  const error = restore.error ?? empty.error;

  return (
    <>
      <DialogHeader>
        <DialogTitle>휴지통</DialogTitle>
        <DialogDescription>삭제한 항목을 원래 폴더로 복구할 수 있습니다.</DialogDescription>
      </DialogHeader>
      <div className="-mx-5 -mt-2 max-h-80 overflow-auto">
        {trash.isLoading ? (
          <p className="px-5 py-6 text-center text-xs text-muted-foreground">불러오는 중…</p>
        ) : trash.error ? (
          <p className="px-5 py-6 text-center text-xs text-destructive">휴지통을 불러오지 못했습니다</p>
        ) : items.length === 0 ? (
          <p className="px-5 py-6 text-center text-xs text-muted-foreground">휴지통이 비어 있습니다</p>
        ) : (
          <ul className="py-1">
            {items.map((e) => (
              <li key={`${e.commitId}:${e.parentDir}/${e.name}`} className="flex h-9 items-center gap-2.5 px-5 text-xs hover:bg-accent/60">
                <EntryIcon entry={{ id: e.name, name: e.name, type: e.type, size: e.size, mtime: e.deletedAt, path: joinPath(e.parentDir, e.name) }} />
                <span className="min-w-0 flex-1 truncate">
                  {e.name}
                  {e.parentDir !== "/" && <span className="ml-1.5 text-2xs text-muted-foreground">{e.parentDir}</span>}
                </span>
                <span className="w-36 shrink-0 truncate text-2xs text-muted-foreground">{formatDateLong(e.deletedAt)}</span>
                <span className="w-16 shrink-0 text-right text-2xs text-muted-foreground tabular-nums">{e.type === "file" ? formatSize(e.size) : ""}</span>
                <Button variant="ghost" size="sm" onClick={() => restore.mutate(e)} disabled={restore.isPending} className="shrink-0">
                  <IconRestore className="size-3.5" /> 복구
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error.message}</p>}
      <DialogFooter className="sm:justify-between">
        <Button variant={confirmEmpty ? "destructive" : "outline"} onClick={() => (confirmEmpty ? empty.mutate() : setConfirmEmpty(true))} disabled={items.length === 0 || empty.isPending}>
          <IconTrash className="size-4" /> {confirmEmpty ? "정말 비우기" : "비우기"}
        </Button>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </>
  );
}
