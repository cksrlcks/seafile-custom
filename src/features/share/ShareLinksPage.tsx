import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { IconCheck, IconCopy, IconExternalLink, IconLock, IconTrash } from "@tabler/icons-react";
import { cn } from "cn";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from "@/components/ui/context-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EntryIcon } from "@/features/browse/FileList";
import { useColumnWidths } from "@/features/browse/useColumnWidths";
import { formatDate } from "@/lib/format";
import { useStorage } from "@/storage/StorageContext";
import { parentPath } from "@/storage/path";
import type { ShareLinkInfo } from "@/storage/StorageProvider";

type Col = "where" | "access" | "expiry" | "views";
const COL_DEFAULT: Record<Col, number> = { where: 220, access: 84, expiry: 150, views: 64 };
const COL_MIN: Record<Col, number> = { where: 100, access: 64, expiry: 90, views: 48 };

/**
 * 공유 링크 페이지(사이드바 하단 메뉴). 파일 목록과 같은 표(머리글·줄무늬·열 조절)에
 * 마지막 열로 복사·삭제 아이콘 버튼을 항상 보여 준다(툴바와 같은 모양). 우클릭 메뉴·더블클릭 열기도 된다. 삭제는 확인창.
 */
export function ShareLinksPage() {
  const storage = useStorage();
  const qc = useQueryClient();
  const { widths, startResize } = useColumnWidths<Col>("seadrive.shareLinkColumns", COL_DEFAULT, COL_MIN);
  const [copied, setCopied] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ShareLinkInfo | null>(null);
  const links = useQuery({ queryKey: ["share-links"], queryFn: () => storage.listShareLinks() });
  const remove = useMutation({
    mutationFn: (token: string) => storage.deleteShareLink(token),
    onSuccess: () => {
      setDeleting(null);
      void qc.invalidateQueries({ queryKey: ["share-links"] });
    },
  });
  const items = links.data ?? [];

  async function copy(l: ShareLinkInfo) {
    await navigator.clipboard.writeText(l.url);
    setCopied(l.token);
    setTimeout(() => setCopied(null), 2000);
  }
  const open = (l: ShareLinkInfo) => window.open(l.url, "_blank", "noopener");
  const where = (l: ShareLinkInfo) => {
    const parent = parentPath(l.path);
    return parent === "/" ? l.libName : `${l.libName} › ${parent.slice(1).split("/").join(" › ")}`;
  };
  const expiry = (l: ShareLinkInfo) => (l.expired ? "만료됨" : l.expiresAt ? `${formatDate(l.expiresAt)}까지` : "없음");

  const notice = (text: string, tone?: "error") => (
    <tr>
      <td colSpan={6} className={cn("py-10 text-center text-xs", tone === "error" ? "text-destructive" : "text-muted-foreground")}>
        {text}
      </td>
    </tr>
  );

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col />
            <col style={{ width: widths.where }} />
            <col style={{ width: widths.access }} />
            <col style={{ width: widths.expiry }} />
            <col style={{ width: widths.views }} />
            <col style={{ width: 84 }} />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="h-7 border-b border-border text-2xs text-muted-foreground">
              <Th className="pl-3" resize="where" onResize={startResize}>
                이름
              </Th>
              <Th resize="access" onResize={startResize}>
                위치
              </Th>
              <Th resize="expiry" onResize={startResize}>
                공개
              </Th>
              <Th resize="views" onResize={startResize}>
                만료
              </Th>
              <Th className="text-right">조회</Th>
              <Th className="pr-3" />
            </tr>
          </thead>
          <tbody>
            {links.isLoading
              ? notice("불러오는 중…")
              : links.error
                ? notice("링크 목록을 불러오지 못했습니다", "error")
                : items.length === 0
                  ? notice("만든 공유 링크가 없습니다. 파일을 우클릭해 만들 수 있습니다.")
                  : items.map((l, i) => (
                      <ContextMenu key={l.token}>
                        <ContextMenuTrigger render={<tr className={cn("h-9 cursor-default select-none hover:bg-accent/50", i % 2 === 1 && "bg-muted/60")} onDoubleClick={() => open(l)} />}>
                          <td className="pl-3">
                            <span className="flex items-center gap-2">
                              <EntryIcon entry={{ id: l.token, name: l.name, type: l.type, size: 0, mtime: l.createdAt, path: l.path }} />
                              <span className="truncate">{l.name}</span>
                            </span>
                          </td>
                          <td className="truncate pl-3 text-muted-foreground">{where(l)}</td>
                          <td className="truncate pl-3">
                            {l.protected ? (
                              <span className="inline-flex items-center gap-1 text-muted-foreground">
                                <IconLock className="size-3.5 shrink-0" stroke={1.75} /> 비공개
                              </span>
                            ) : (
                              <span className="text-muted-foreground">공개</span>
                            )}
                          </td>
                          <td className={cn("truncate pl-3", l.expired ? "text-destructive" : "text-muted-foreground")}>{expiry(l)}</td>
                          <td className="pl-3 text-right text-muted-foreground tabular-nums">{l.views}</td>
                          <td className="pr-3 pl-3">
                            <span className="flex items-center justify-end gap-0.5">
                              <IconBtn label={copied === l.token ? "복사됨" : "링크 복사"} onClick={() => void copy(l)}>
                                {copied === l.token ? <IconCheck className="size-4 text-success" /> : <IconCopy className="size-4" stroke={1.75} />}
                              </IconBtn>
                              <IconBtn label="링크 삭제" onClick={() => setDeleting(l)} className="hover:text-destructive">
                                <IconTrash className="size-4" stroke={1.75} />
                              </IconBtn>
                            </span>
                          </td>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="min-w-44">
                          <ContextMenuItem onClick={() => void copy(l)} className="text-sm">
                            <IconCopy className="size-4" /> 링크 복사
                          </ContextMenuItem>
                          <ContextMenuItem onClick={() => open(l)} className="text-sm">
                            <IconExternalLink className="size-4" /> 브라우저에서 열기
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem variant="destructive" onClick={() => setDeleting(l)} className="text-sm">
                            <IconTrash className="size-4" /> 링크 삭제
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
          </tbody>
        </table>
        {remove.error && <p className="px-3 py-2 text-xs text-destructive">{remove.error.message}</p>}
      </div>

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{`'${deleting?.name ?? ""}' 링크를 삭제할까요?`}</DialogTitle>
            <DialogDescription>링크를 받은 사람도 더는 열 수 없습니다. 다시 만들 수는 있지만 주소는 달라집니다.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              취소
            </Button>
            <Button variant="destructive" onClick={() => deleting && remove.mutate(deleting.token)} disabled={remove.isPending}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** 머리글 셀. resize가 있으면 오른쪽 경계를 끌어 "다음 열"의 너비를 조절한다(파일 목록과 같은 방식). */
function Th({ className, children, resize, onResize }: { className?: string; children?: ReactNode; resize?: Col; onResize?(key: Col, e: React.PointerEvent): void }) {
  return (
    <th className={cn("relative cursor-default overflow-hidden pl-3 text-left font-normal whitespace-nowrap select-none", className)}>
      {children}
      {resize && (
        <span role="separator" aria-orientation="vertical" onPointerDown={(e) => onResize?.(resize, e)} className="group absolute top-0 right-0 bottom-0 z-20 w-2 translate-x-1/2 cursor-col-resize">
          <span className="absolute top-1.5 bottom-1.5 left-1/2 w-px bg-border group-hover:bg-primary" />
        </span>
      )}
    </th>
  );
}

/** 툴바와 같은 모양의 툴팁 아이콘 버튼 */
function IconBtn({ label, onClick, className, children }: { label: string; onClick(): void; className?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Button variant="ghost" size="icon-sm" onClick={onClick} aria-label={label} className={cn("size-7 rounded-md text-foreground/80", className)} />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
