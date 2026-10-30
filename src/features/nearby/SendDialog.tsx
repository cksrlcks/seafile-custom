import { IconDeviceDesktop, IconFile, IconPlus } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { setPrefs, useAppPrefs } from "@/features/settings/appPrefs";
import { formatSize } from "@/lib/format";
import { useStorage } from "@/storage/StorageContext";
import type { Entry } from "@/storage/StorageProvider";
import { sendDrive, sendLocal, useNearby, type Peer } from "./nearby";

/** 드라이브에서 고른 파일, 또는 내 PC에서 고를 파일 */
export type SendSource = { kind: "drive"; libId: string; entries: Entry[] } | { kind: "local" };

const SHOWN_FILES = 5;

/** 받을 사람을 누르면 바로 보낸다. 진행은 오른쪽 아래 패널에서 */
export function SendDialog({ source, onClose }: { source: SendSource | null; onClose(): void }) {
  return (
    <Dialog open={!!source} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">{source && <Body source={source} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ source, onClose }: { source: SendSource; onClose(): void }) {
  const storage = useStorage();
  const { peers, error } = useNearby();
  const { nearbyVisible } = useAppPrefs();
  const [paths, setPaths] = useState<string[]>([]);
  const driveFiles = source.kind === "drive" ? source.entries.filter((e) => e.type === "file") : [];
  const names = source.kind === "drive" ? driveFiles.map((e) => e.name) : paths.map((p) => p.split(/[\\/]/).pop() ?? p);
  const size = driveFiles.reduce((a, e) => a + e.size, 0);

  async function pick() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const r = await open({ title: "보낼 파일", multiple: true });
    if (r) setPaths((cur) => [...new Set([...cur, ...r])]);
  }
  // 트레이·메뉴에서 열면 바로 파일부터 고르게 한다
  useEffect(() => {
    if (source.kind === "local") void pick();
  }, [source.kind]);

  function send(peer: Peer) {
    if (source.kind === "drive") void sendDrive(peer, driveFiles, (e) => storage.downloadUrl(source.libId, e.path));
    else void sendLocal(peer, paths);
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>근처로 보내기</DialogTitle>
        <DialogDescription>같은 네트워크에서 같은 서버에 로그인한 U-Drive에 서버를 거치지 않고 바로 보냅니다</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        {names.length > 0 ? (
          <ul className="grid gap-0.5 rounded-md border border-border px-2.5 py-1.5 text-xs">
            {names.slice(0, SHOWN_FILES).map((n, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <IconFile className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{n}</span>
              </li>
            ))}
            {names.length > SHOWN_FILES && <li className="text-muted-foreground">외 {names.length - SHOWN_FILES}개</li>}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">보낼 파일을 고르세요</p>
        )}
        <div className="flex items-center justify-between text-2xs text-muted-foreground">
          <span>{names.length > 0 && `${names.length}개${size ? ` · ${formatSize(size)}` : ""}`}</span>
          {source.kind === "local" && (
            <Button variant="outline" size="xs" onClick={() => void pick()}>
              <IconPlus className="size-3" /> 파일 선택…
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-1.5">
        <div className="text-xs font-medium">받을 사람</div>
        {!nearbyVisible ? (
          <Notice text="근처로 보내기가 꺼져 있습니다">
            <Button variant="outline" size="xs" onClick={() => setPrefs({ nearbyVisible: true })}>
              켜기
            </Button>
          </Notice>
        ) : error ? (
          <Notice text={`근처를 찾지 못했습니다 (${error})`} />
        ) : peers.length === 0 ? (
          <Notice text="찾는 중… 상대도 U-Drive를 켜 두고 같은 서버에 로그인해 있어야 보입니다" />
        ) : (
          <ul className="grid max-h-64 gap-1 overflow-auto">
            {peers.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={names.length === 0}
                  onClick={() => send(p)}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">{p.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{p.name}</span>
                    <span className="flex items-center gap-1 truncate text-2xs text-muted-foreground">
                      <IconDeviceDesktop className="size-3 shrink-0" />
                      {p.device} · {p.email}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          닫기
        </Button>
      </DialogFooter>
    </>
  );
}

function Notice({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
      <span>{text}</span>
      {children}
    </div>
  );
}
