import { IconDeviceDesktop, IconLoader2 } from "@tabler/icons-react";
import { cn } from "cn";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EntryIcon } from "@/features/browse/FileList";
import { setPrefs, useAppPrefs } from "@/features/settings/appPrefs";
import { formatSize } from "@/lib/format";
import { useStorage } from "@/storage/StorageContext";
import type { Entry } from "@/storage/StorageProvider";
import { sendDrive, sendLocal, useNearby, type Peer } from "./nearby";

/** 드라이브에서 고른 파일, 또는 내 PC에서 고를 파일 */
export type SendSource = { kind: "drive"; libId: string; entries: Entry[] } | { kind: "local" };

/** 받는 사람을 고르고 [보내기]. 진행은 오른쪽 아래 패널에서 */
export function SendDialog({ source, onClose }: { source: SendSource | null; onClose(): void }) {
  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">{source && <Body source={source} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

const localEntry = (path: string): Entry => ({ id: path, name: path.split(/[\\/]/).pop() ?? path, type: "file", size: 0, mtime: 0, path });

function Body({ source, onClose }: { source: SendSource; onClose(): void }) {
  const storage = useStorage();
  const { peers, error } = useNearby();
  const { nearbyVisible } = useAppPrefs();
  const [paths, setPaths] = useState<string[]>([]);
  const [peerId, setPeerId] = useState<string | null>(null);
  const files = source.kind === "drive" ? source.entries.filter((e) => e.type === "file") : paths.map(localEntry);
  const size = files.reduce((a, e) => a + e.size, 0);
  const peer = peers.find((p) => p.id === peerId) ?? null;

  async function pick() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({ title: "보낼 파일", multiple: true });
    if (r) setPaths((cur) => [...new Set([...cur, ...r])]);
  }
  // 메뉴·트레이에서 열면 파일부터 고르게 한다
  useEffect(() => {
    if (source.kind === "local") void pick();
  }, [source.kind]);

  function send(to: Peer) {
    if (source.kind === "drive") void sendDrive(to, files, (e) => storage.downloadUrl(source.libId, e.path));
    else void sendLocal(to, paths);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>바로 보내기</DialogTitle>
        <DialogDescription>같은 네트워크에서 같은 서버에 로그인한 사람에게 서버를 거치지 않고 보냅니다</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <div className="flex h-6 items-center justify-between text-xs">
          <span className="text-muted-foreground">
            보낼 파일{files.length > 0 && ` ${files.length}개${size ? ` · ${formatSize(size)}` : ""}`}
          </span>
          {source.kind === "local" && (
            <Button variant="outline" size="xs" onClick={() => void pick()}>
              파일 추가…
            </Button>
          )}
        </div>
        <ListBox className="max-h-[7.25rem]" empty={files.length === 0 && "보낼 파일을 추가하세요"}>
          {files.map((e) => (
            <div key={e.path} className="flex h-7 items-center gap-2 px-2 text-sm" title={e.path}>
              <EntryIcon entry={e} />
              <span className="min-w-0 flex-1 truncate">{e.name}</span>
              {e.size > 0 && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatSize(e.size)}</span>}
            </div>
          ))}
        </ListBox>
      </div>

      <div className="grid gap-1.5">
        <div className="flex h-6 items-center gap-1.5 text-xs text-muted-foreground">
          받는 사람
          {nearbyVisible && !error && <IconLoader2 className="size-3 animate-spin" aria-label="찾는 중" />}
        </div>
        <ListBox
          className="h-[8.5rem]"
          empty={
            !nearbyVisible ? (
              <>
                바로 보내기가 꺼져 있습니다
                <Button variant="outline" size="xs" onClick={() => setPrefs({ nearbyVisible: true })}>
                  켜기
                </Button>
              </>
            ) : error ? (
              `주변을 찾지 못했습니다 (${error})`
            ) : (
              peers.length === 0 && "상대가 U-Drive를 켜 두고 같은 서버에 로그인해 있어야 보입니다"
            )
          }
        >
          {nearbyVisible &&
            peers.map((p) => (
              <div
                key={p.id}
                role="option"
                aria-selected={p.id === peerId}
                title={p.email}
                onClick={() => setPeerId(p.id)}
                onDoubleClick={() => files.length > 0 && send(p)}
                className={cn("flex h-8 cursor-default items-center gap-2 px-2 text-sm", p.id === peerId ? "bg-selection" : "hover:bg-accent")}
              >
                <IconDeviceDesktop className={cn("size-4 shrink-0", p.id === peerId ? "text-primary" : "text-muted-foreground")} stroke={1.75} />
                <span className="truncate font-medium">{p.name}</span>
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{p.device}</span>
              </div>
            ))}
        </ListBox>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button disabled={!peer || files.length === 0} onClick={() => peer && send(peer)}>
          보내기
        </Button>
      </DialogFooter>
    </>
  );
}

/** 탐색기 목록처럼 테두리 친 상자. empty가 있으면 가운데 안내 문구 */
function ListBox({ className, empty, children }: { className?: string; empty?: ReactNode; children: ReactNode }) {
  return (
    <div role="listbox" className={cn("overflow-y-auto rounded-md border border-border bg-background py-0.5", className)}>
      {empty ? <div className="flex h-full min-h-14 flex-col items-center justify-center gap-2 px-4 text-center text-xs text-muted-foreground">{empty}</div> : children}
    </div>
  );
}
