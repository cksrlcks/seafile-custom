import { logError } from "@/lib/errorLog";

/** 실제 저장 동작: url을 path(디스크)로 스트리밍. Tauri에서는 upload 플러그인의 download. */
export type Saver = (url: string, path: string, onProgress: (received: number, total: number) => void) => Promise<void>;

export type DownloadStatus = "queued" | "downloading" | "done" | "failed";

export interface DownloadJob {
  name: string;
  size: number;
  /** 임시 다운로드 링크는 만료되므로 시작 직전에 받는다 */
  url(): Promise<string>;
  path: string;
}

export interface DownloadItem {
  id: string;
  job: DownloadJob;
  status: DownloadStatus;
  received: number;
  total: number;
  error?: string;
}

/** 동시 2개. 업로드 큐와 같은 subscribe/getSnapshot 모양(useSyncExternalStore용). */
// ponytail: 취소 없음 — Tauri upload 플러그인 download에 중단 API가 없다. 필요하면 Rust 커맨드로 직접 구현.
export class DownloadQueue {
  private items: DownloadItem[] = [];
  private listeners = new Set<(items: DownloadItem[]) => void>();
  private running = 0;
  private seq = 0;

  constructor(
    private save: Saver,
    private concurrency = 2,
  ) {}

  /** 새 항목 id를 돌려준다(완료를 기다릴 때 쓴다) */
  add(jobs: DownloadJob[]): string[] {
    const ids = jobs.map(() => String(++this.seq));
    jobs.forEach((job, i) => this.items.push({ id: ids[i], job, status: "queued", received: 0, total: job.size }));
    this.emit();
    this.pump();
    return ids;
  }

  retry(id: string): void {
    const it = this.items.find((i) => i.id === id);
    if (!it || it.status !== "failed") return;
    this.update(id, { status: "queued", received: 0, error: undefined });
    this.pump();
  }

  clearFinished(): void {
    this.items = this.items.filter((i) => i.status === "queued" || i.status === "downloading");
    this.emit();
  }

  subscribe = (fn: (items: DownloadItem[]) => void): (() => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  getSnapshot = (): DownloadItem[] => this.items;

  private update(id: string, patch: Partial<DownloadItem>) {
    this.items = this.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn(this.items);
  }

  private pump() {
    while (this.running < this.concurrency) {
      const next = this.items.find((i) => i.status === "queued");
      if (!next) return;
      void this.run(next);
    }
  }

  private async run(item: DownloadItem) {
    this.running++;
    this.update(item.id, { status: "downloading" });
    try {
      const url = await item.job.url();
      await this.save(url, item.job.path, (received, total) => this.update(item.id, { received, total: total > 0 ? total : item.job.size }));
      const cur = this.items.find((i) => i.id === item.id)!;
      this.update(item.id, { status: "done", received: cur.total });
    } catch (e) {
      logError("download", e);
      this.update(item.id, { status: "failed", error: (e as Error).message ?? String(e) });
    } finally {
      this.running--;
      this.pump();
    }
  }
}
