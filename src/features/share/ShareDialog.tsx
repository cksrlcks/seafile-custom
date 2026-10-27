import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconCheck, IconCopy, IconLink } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useStorage } from "@/storage/StorageContext";
import { passwordProblem, SHARE_LINK_PASSWORD_MIN_LENGTH } from "./passwordPolicy";
import { isAlreadyExists, shareErrorMessage } from "./shareError";
import { directDownloadUrl } from "./shareUrls";
import type { Entry, ShareLink } from "@/storage/StorageProvider";

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
  const qc = useQueryClient();
  const [password, setPassword] = useState("");
  const [expireDays, setExpireDays] = useState("");
  const [copied, setCopied] = useState<"page" | "direct" | null>(null);
  const problem = passwordProblem(password);
  /** 비밀번호나 만료를 넣었는데 기존 링크가 재사용되면 그 설정이 버려진 것이라 "지우고 새로 만들기"를 권한다 */
  const wantsOptions = password !== "" || expireDays !== "";
  const create = useMutation({
    mutationFn: async (opts?: { replaceToken?: string }): Promise<ShareLink & { reused?: boolean; token?: string }> => {
      if (opts?.replaceToken) await storage.deleteShareLink(opts.replaceToken);
      try {
        return await storage.createShareLink(libId, entry.path, {
          password: password || undefined,
          expireDays: expireDays ? Number(expireDays) : undefined,
        });
      } catch (e) {
        // 서버가 파일당 링크 하나만 허용하면 "already exists"로 거절한다. 그 링크를 찾아 보여 준다
        if (!isAlreadyExists(e)) throw e;
        const existing = (await storage.listShareLinks()).find((l) => l.libId === libId && l.path === entry.path);
        if (!existing) throw e;
        return { url: existing.url, expiresAt: existing.expiresAt, reused: true, token: existing.token };
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["share-links"] }),
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
          {create.data.reused && (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/50 p-3 text-xs">
              <p className={wantsOptions ? "text-destructive" : "text-muted-foreground"}>
                {wantsOptions ? "이미 만든 링크가 있어 입력한 비밀번호·만료는 적용되지 않았습니다." : "이미 만든 링크가 있어 그 링크를 보여 줍니다."}
              </p>
              <Button variant="outline" size="sm" onClick={() => create.mutate({ replaceToken: create.data?.token })} disabled={create.isPending} className="self-start">
                {create.isPending ? "다시 만드는 중..." : "기존 링크를 지우고 새로 만들기"}
              </Button>
            </div>
          )}
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
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" aria-invalid={!!problem} />
            <span className={problem ? "text-2xs text-destructive" : "text-2xs"}>{problem ?? `${SHARE_LINK_PASSWORD_MIN_LENGTH}자 이상 (서버 기본 정책)`}</span>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            만료 (일, 선택)
            <Input type="number" min={1} value={expireDays} onChange={(e) => setExpireDays(e.target.value)} placeholder="없음" />
          </label>
          {create.error && <p className="text-xs text-destructive">{shareErrorMessage(create.error)}</p>}
        </div>
      )}
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>닫기</DialogClose>
        {!create.data && (
          <Button onClick={() => create.mutate()} disabled={create.isPending || !!problem}>
            <IconLink className="size-4" /> {create.isPending ? "만드는 중..." : "링크 만들기"}
          </Button>
        )}
      </DialogFooter>
    </>
  );
}
