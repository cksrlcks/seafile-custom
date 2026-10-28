import { logError } from "@/lib/errorLog";
import { joinPath, parentPath } from "@/storage/path";
import { StorageError, type StorageProvider, type UploadTask } from "@/storage/StorageProvider";

export type UploadStatus = "queued" | "uploading" | "done" | "failed" | "cancelled";

export interface UploadItem {
  id: string;
  task: UploadTask;
  libId: string;
  status: UploadStatus;
  sent: number;
  total: number;
  error?: string;
  attempts: number;
}

interface Opts {
  concurrency?: number;
  retries?: number;
}

export class UploadQueue {
  private items: UploadItem[] = [];
  private controllers = new Map<string, AbortController>();
  private listeners = new Set<(items: UploadItem[]) => void>();
  private running = 0;
  private seq = 0;
  private readonly concurrency: number;
  private readonly retries: number;
  onAllDone?: (libId: string, dirs: Set<string>) => void;
  /** 401: 재시도하지 않고 즉시 실패시킨 뒤 알린다 */
  onUnauthorized?: () => void;
  private pendingDirs = new Map<string, Set<string>>();

  constructor(
    private provider: StorageProvider,
    opts: Opts = {},
  ) {
    this.concurrency = opts.concurrency ?? 3;
    this.retries = opts.retries ?? 2;
  }

  /** 새 항목 id를 돌려준다(완료를 기다릴 때 쓴다) */
  add(libId: string, tasks: UploadTask[]): string[] {
    const ids: string[] = [];
    for (const task of tasks) {
      const id = String(++this.seq);
      ids.push(id);
      this.items.push({ id, task, libId, status: "queued", sent: 0, total: task.file.size, attempts: 0 });
      const dirs = this.pendingDirs.get(libId) ?? new Set<string>();
      // 잎 경로부터 targetDir까지 모든 조상: 폴더 드롭 시 보고 있던 폴더와 중간 폴더도 갱신돼야 한다
      let d = task.relativePath ? joinPath(task.targetDir, task.relativePath) : task.targetDir;
      for (;;) {
        dirs.add(d);
        if (d === task.targetDir || d === "/") break;
        d = parentPath(d);
      }
      this.pendingDirs.set(libId, dirs);
    }
    this.emit();
    this.pump();
    return ids;
  }

  retry(id: string): void {
    const item = this.find(id);
    if (!item || (item.status !== "failed" && item.status !== "cancelled")) return;
    this.update(id, { status: "queued", attempts: 0, error: undefined, sent: 0 });
    this.pump();
  }

  cancel(id: string): void {
    const item = this.find(id);
    if (!item) return;
    if (item.status === "queued") this.update(id, { status: "cancelled" });
    else if (item.status === "uploading") this.controllers.get(id)?.abort();
  }

  cancelAll(): void {
    for (const item of this.items) this.cancel(item.id);
  }

  clearFinished(): void {
    this.items = this.items.filter((i) => i.status === "queued" || i.status === "uploading");
    this.emit();
  }

  subscribe = (fn: (items: UploadItem[]) => void): (() => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };

  getSnapshot = (): UploadItem[] => this.items;

  private find(id: string) {
    return this.items.find((i) => i.id === id);
  }

  private update(id: string, patch: Partial<UploadItem>) {
    this.items = this.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
    this.emit();
  }

  private emit() {
    for (const fn of this.listeners) fn(this.items);
  }

  private pump() {
    while (this.running < this.concurrency) {
      const next = this.items.find((i) => i.status === "queued");
      if (!next) break;
      void this.run(next.id);
    }
    if (this.running === 0 && !this.items.some((i) => i.status === "queued")) this.flushDone();
  }

  private async run(id: string) {
    this.running++;
    const ctrl = new AbortController();
    this.controllers.set(id, ctrl);
    const item = this.find(id)!;
    this.update(id, { status: "uploading", attempts: item.attempts + 1 });
    try {
      await this.provider.upload(item.libId, item.task, (sent, total) => this.update(id, { sent, total }), ctrl.signal);
      this.update(id, { status: "done", sent: item.total });
    } catch (e) {
      const cur = this.find(id)!;
      const unauthorized = e instanceof StorageError && e.kind === "unauthorized";
      if (ctrl.signal.aborted) this.update(id, { status: "cancelled" });
      else if (unauthorized) {
        this.update(id, { status: "failed", error: "로그인이 필요합니다" });
        this.onUnauthorized?.();
      } else if (cur.attempts <= this.retries) this.update(id, { status: "queued", sent: 0 });
      else {
        logError("upload", e);
        this.update(id, { status: "failed", error: (e as Error).message });
      }
    } finally {
      this.controllers.delete(id);
      this.running--;
      this.pump();
    }
  }

  private flushDone() {
    if (!this.onAllDone) return;
    const done = new Map(this.pendingDirs);
    this.pendingDirs.clear();
    for (const [libId, dirs] of done) if (this.items.some((i) => i.libId === libId && i.status === "done")) this.onAllDone(libId, dirs);
  }
}
