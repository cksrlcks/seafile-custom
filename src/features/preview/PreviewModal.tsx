import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatSize } from "@/lib/format";
import { useStorage } from "@/storage/StorageContext";
import type { Entry } from "@/storage/StorageProvider";
import { previewKind } from "./previewKind";

const TEXT_LIMIT = 1024 * 1024;

interface Props {
  libId: string;
  /** 현재 폴더에서 미리보기 가능한 파일만 */
  entries: Entry[];
  index: number;
  onClose(): void;
  onNavigate(index: number): void;
  onDownload(entry: Entry): void;
}

export function PreviewModal({ libId, entries, index, onClose, onNavigate, onDownload }: Props) {
  const entry = entries[index];
  const open = entry !== undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
      if (e.key === "ArrowRight" && index < entries.length - 1) onNavigate(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, entries.length, onNavigate]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} className="flex h-[88vh] w-[92vw] max-w-6xl flex-col gap-0 overflow-hidden p-0 sm:max-w-6xl">
        {entry && (
          <>
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
              <DialogTitle className="min-w-0 flex-1 truncate text-sm font-medium">{entry.name}</DialogTitle>
              <span className="text-xs text-muted-foreground">{formatSize(entry.size)}</span>
              <span className="mx-1 text-xs text-muted-foreground">
                {index + 1} / {entries.length}
              </span>
              <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => onNavigate(index - 1)} title="이전">
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="ghost" size="icon-sm" disabled={index >= entries.length - 1} onClick={() => onNavigate(index + 1)} title="다음">
                <ChevronRight className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => onDownload(entry)}>
                <Download className="size-4" /> 다운로드
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={onClose} title="닫기 (Esc)">
                <X className="size-4" />
              </Button>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/40">
              <Body key={entry.path} libId={libId} entry={entry} onDownload={onDownload} />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({ libId, entry, onDownload }: { libId: string; entry: Entry; onDownload(entry: Entry): void }) {
  const storage = useStorage();
  const kind = previewKind(entry.name);
  const tooBig = kind === "text" && entry.size > TEXT_LIMIT;
  const url = useQuery({
    queryKey: ["previewUrl", libId, entry.path],
    queryFn: () => storage.previewUrl(libId, entry.path),
    enabled: kind === "image" || kind === "pdf",
  });
  // PDF: 다운로드 링크는 attachment 헤더가 붙어 iframe이 저장을 시작하므로 blob으로 받아 띄운다
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState(false);
  useEffect(() => {
    if (kind !== "pdf" || !url.data) return;
    let objectUrl: string | null = null;
    const ctrl = new AbortController();
    fetch(url.data, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(r.statusText))))
      .then((b) => {
        objectUrl = URL.createObjectURL(b.type === "application/pdf" ? b : new Blob([b], { type: "application/pdf" }));
        setPdfUrl(objectUrl);
      })
      .catch((e) => e.name !== "AbortError" && setPdfError(true));
    return () => {
      ctrl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [kind, url.data]);
  const text = useQuery({
    queryKey: ["text", libId, entry.path],
    queryFn: () => storage.readText(libId, entry.path),
    enabled: kind === "text" && !tooBig,
  });

  if (tooBig)
    return (
      <Fallback message="1MB 이상 텍스트는 미리보기하지 않습니다">
        <Button onClick={() => onDownload(entry)}>
          <Download className="size-4" /> 다운로드
        </Button>
      </Fallback>
    );
  if (url.error || text.error || pdfError) return <Fallback message="불러오지 못했습니다" />;
  if (kind === "image") return url.data ? <img src={url.data} alt={entry.name} className="max-h-full max-w-full object-contain" /> : <Loading />;
  if (kind === "pdf") return pdfUrl ? <iframe src={pdfUrl} title={entry.name} className="h-full w-full bg-card" /> : <Loading />;
  if (kind === "text")
    return text.data !== undefined ? (
      <pre className="h-full w-full overflow-auto bg-card p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap">{text.data}</pre>
    ) : (
      <Loading />
    );
  return (
    <Fallback message="미리보기를 지원하지 않는 형식입니다">
      <Button onClick={() => onDownload(entry)}>
        <Download className="size-4" /> 다운로드
      </Button>
    </Fallback>
  );
}

function Loading() {
  return <div className="text-sm text-muted-foreground">불러오는 중...</div>;
}

function Fallback({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 text-sm text-muted-foreground">
      <span>{message}</span>
      {children}
    </div>
  );
}
