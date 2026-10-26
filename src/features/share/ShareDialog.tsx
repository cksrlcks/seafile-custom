import { useMutation } from "@tanstack/react-query";
import { IconCheck, IconCopy, IconLink } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStorage } from "@/storage/StorageContext";
import { directDownloadUrl } from "./shareUrls";
import type { Entry } from "@/storage/StorageProvider";

interface Props {
  libId: string;
  entry: Entry | null;
  onClose(): void;
}

export function ShareDialog({ libId, entry, onClose }: Props) {
  return (
    <Dialog open={entry !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>{entry && <Body key={entry.path} libId={libId} entry={entry} />}</DialogContent>
    </Dialog>
  );
}

function Body({ libId, entry }: { libId: string; entry: Entry }) {
  const storage = useStorage();
  const [password, setPassword] = useState("");
  const [expireDays, setExpireDays] = useState("");
  const [copied, setCopied] = useState<"page" | "direct" | null>(null);
  const create = useMutation({
    mutationFn: () =>
      storage.createShareLink(libId, entry.path, {
        password: password || undefined,
        expireDays: expireDays ? Number(expireDays) : undefined,
      }),
  });

  async function copy(kind: "page" | "direct") {
    if (!create.data) return;
    await navigator.clipboard.writeText(kind === "direct" ? directDownloadUrl(create.data.url) : create.data.url);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>공유 링크</DialogTitle>
        <DialogDescription className="truncate">{entry.name}</DialogDescription>
      </DialogHeader>
      {create.data ? (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            공유 페이지 링크
            <div className="flex gap-2">
              <Input readOnly value={create.data.url} onFocus={(e) => e.target.select()} />
              <Button variant="outline" onClick={() => copy("page")} className="shrink-0">
                {copied === "page" ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
                {copied === "page" ? "복사됨" : "복사"}
              </Button>
            </div>
          </label>
          {entry.type === "file" && (
            <label className="flex flex-col gap-1 text-xs text-muted-foreground">
              직접 다운로드 링크 (페이지 없이 바로 저장)
              <div className="flex gap-2">
                <Input readOnly value={directDownloadUrl(create.data.url)} onFocus={(e) => e.target.select()} />
                <Button variant="outline" onClick={() => copy("direct")} className="shrink-0">
                  {copied === "direct" ? <IconCheck className="size-4" /> : <IconCopy className="size-4" />}
                  {copied === "direct" ? "복사됨" : "복사"}
                </Button>
              </div>
            </label>
          )}
          {create.data.expiresAt && <p className="text-xs text-muted-foreground">{new Date(create.data.expiresAt * 1000).toLocaleDateString("ko-KR")}까지 유효</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            비밀번호 (선택)
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            만료 (일, 선택)
            <Input type="number" min={1} value={expireDays} onChange={(e) => setExpireDays(e.target.value)} placeholder="없음" />
          </label>
          {create.error && <p className="text-xs text-destructive">링크를 만들지 못했습니다</p>}
        </div>
      )}
      {!create.data && (
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            <IconLink className="size-4" /> {create.isPending ? "만드는 중..." : "링크 만들기"}
          </Button>
        </DialogFooter>
      )}
    </>
  );
}
