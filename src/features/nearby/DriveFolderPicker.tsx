import { IconArrowUp, IconChevronRight, IconCloud } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "cn";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntryIcon } from "@/features/browse/FileList";
import { useLibraries } from "@/features/browse/useCurrentDir";
import type { DriveFolder } from "@/features/settings/appPrefs";
import { joinPath, parentPath, splitPath } from "@/storage/path";
import { useStorage } from "@/storage/StorageContext";

/** 드라이브 폴더 고르기. 저장소 목록 → 폴더를 더블클릭해 들어가고 [이 폴더 선택] */
export function DriveFolderPicker({ open, initial, onPick, onClose }: { open: boolean; initial: DriveFolder | null; onPick(f: DriveFolder): void; onClose(): void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{open && <Body initial={initial} onPick={onPick} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ initial, onPick, onClose }: { initial: DriveFolder | null; onPick(f: DriveFolder): void; onClose(): void }) {
  const storage = useStorage();
  const libs = useLibraries();
  // lib이 없으면 저장소 목록을 보는 중. 처음엔 지금 정해진 폴더의 상위(없을 수 있는 '받은 파일' 대신 그 위)
  const [at, setAt] = useState<{ lib: { id: string; name: string } | null; path: string }>(initial ? { lib: { id: initial.libId, name: initial.libName }, path: parentPath(initial.path) } : { lib: null, path: "/" });
  const [sel, setSel] = useState<string | null>(initial?.path ?? null);
  const dir = useQuery({ queryKey: ["picker-dir", at.lib?.id, at.path], queryFn: () => storage.listDir(at.lib!.id, at.path), enabled: !!at.lib });
  const folders = (dir.data ?? []).filter((e) => e.type === "dir").sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const writable = (libs.data ?? []).filter((l) => !l.encrypted && !l.readOnly);

  const go = (lib: { id: string; name: string } | null, path: string) => {
    setAt({ lib, path });
    setSel(null);
  };
  const up = () => (at.path === "/" ? go(null, "/") : go(at.lib, parentPath(at.path)));
  // 고른 폴더가 없으면 지금 보고 있는 폴더
  const chosen = at.lib ? { libId: at.lib.id, libName: at.lib.name, path: sel ?? at.path } : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>받을 폴더</DialogTitle>
        <DialogDescription>바로 보내기로 드라이브에 받을 때 이 폴더에 올립니다</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <div className="flex h-7 items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={up} disabled={!at.lib} aria-label="위로" className="size-7 rounded-md text-foreground/80">
            <IconArrowUp className="size-4" stroke={1.75} />
          </Button>
          <div className="flex h-7 min-w-0 flex-1 items-center gap-0.5 overflow-hidden rounded-md border border-border bg-background px-1.5 text-sm">
            <button type="button" onClick={() => go(null, "/")} className="shrink-0 rounded px-1 text-foreground/80 hover:bg-accent">
              저장소
            </button>
            {at.lib && (
              <>
                <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" stroke={1.75} />
                <button type="button" onClick={() => go(at.lib, "/")} className="truncate rounded px-1 text-foreground/80 hover:bg-accent">
                  {at.lib.name}
                </button>
              </>
            )}
            {splitPath(at.path).map((seg, i, all) => (
              <span key={i} className="flex min-w-0 items-center">
                <IconChevronRight className="size-3.5 shrink-0 text-muted-foreground" stroke={1.75} />
                <button type="button" onClick={() => go(at.lib, "/" + all.slice(0, i + 1).join("/"))} className="truncate rounded px-1 text-foreground/80 hover:bg-accent">
                  {seg}
                </button>
              </span>
            ))}
          </div>
        </div>

        <div role="listbox" className="flex h-56 flex-col gap-px overflow-y-auto rounded-md border border-border bg-background p-0.5">
          {!at.lib
            ? writable.map((l) => (
                <Row key={l.id} selected={false} onOpen={() => go({ id: l.id, name: l.name }, "/")} icon={<IconCloud className="size-4 text-muted-foreground" stroke={1.75} />} label={l.name} hint={l.section} />
              ))
            : folders.map((f) => (
                <Row key={f.path} selected={sel === f.path} onSelect={() => setSel(f.path)} onOpen={() => go(at.lib, joinPath(at.path, f.name))} icon={<EntryIcon entry={f} />} label={f.name} />
              ))}
          {at.lib && dir.isSuccess && folders.length === 0 && <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">하위 폴더가 없습니다</div>}
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {chosen ? `${chosen.libName}${chosen.path === "/" ? "" : chosen.path}` : "저장소를 더블클릭해 들어가세요"}
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button disabled={!chosen} onClick={() => chosen && onPick(chosen)}>
          이 폴더 선택
        </Button>
      </DialogFooter>
    </>
  );
}

function Row({ icon, label, hint, selected, onSelect, onOpen }: { icon: React.ReactNode; label: string; hint?: string; selected: boolean; onSelect?(): void; onOpen(): void }) {
  return (
    <div role="option" aria-selected={selected} onClick={onSelect ?? onOpen} onDoubleClick={onOpen} className={cn("flex h-7 shrink-0 cursor-default items-center gap-2 rounded-[5px] px-2 text-sm", selected ? "bg-selection" : "hover:bg-accent")}>
      {icon}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
    </div>
  );
}
