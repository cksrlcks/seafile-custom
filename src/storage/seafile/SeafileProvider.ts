import { StorageError, type Account, type Entry, type Library, type ShareLink, type StorageProvider, type UploadTask } from "../StorageProvider";
import { joinPath } from "../path";
import { SeafileApi } from "./api";
import { CHUNK_SIZE, chunkRanges } from "./chunk";
import { clearInterrupted, isInterrupted, markInterrupted } from "./resumeRegistry";
import { xhrUpload } from "./xhrUpload";

interface RepoDto { id: string; name: string; size: number; mtime: number; encrypted: boolean }
interface DirentDto { id: string; name: string; type: "file" | "dir"; size?: number; mtime: number }

function isLinkExpired(e: unknown): boolean {
  const status = (e as { status?: number }).status;
  return status === 403 || status === 500;
}

export class SeafileProvider implements StorageProvider {
  private _token: string | null;
  protected api: SeafileApi;

  constructor(baseUrl: string, initialToken: string | null) {
    this._token = initialToken;
    this.api = new SeafileApi(baseUrl, () => this._token);
  }

  get token(): string | null {
    return this._token;
  }

  async login(username: string, password: string, otp?: string): Promise<void> {
    const res = await this.api.postForm<{ token: string }>(
      "/api2/auth-token/",
      { username, password },
      undefined,
      otp ? { "X-SEAFILE-OTP": otp } : undefined,
    );
    this._token = res.token;
  }

  async logout(): Promise<void> {
    this._token = null;
  }

  isLoggedIn(): boolean {
    return this._token !== null;
  }

  async getAccount(): Promise<Account> {
    const r = await this.api.get<{ email: string; name?: string; usage: number; total: number }>("/api2/account/info/");
    return { email: r.email, name: r.name || r.email, usage: r.usage, quota: r.total > 0 ? r.total : null };
  }

  async listLibraries(): Promise<Library[]> {
    const repos = await this.api.get<RepoDto[]>("/api2/repos/");
    return repos.map((r) => ({ id: r.id, name: r.name, size: r.size, mtime: r.mtime, encrypted: !!r.encrypted }));
  }

  async renameLibrary(libId: string, newName: string): Promise<void> {
    await this.api.postForm(`/api2/repos/${libId}/`, { repo_name: newName }, { op: "rename" });
  }

  async listDir(libId: string, path: string): Promise<Entry[]> {
    const items = await this.api.get<DirentDto[]>(`/api2/repos/${libId}/dir/`, { p: path });
    return items
      .map((d) => ({ id: d.id, name: d.name, type: d.type, size: d.size ?? 0, mtime: d.mtime, path: joinPath(path, d.name) }))
      .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "dir" ? -1 : 1));
  }

  async upload(libId: string, task: UploadTask, onProgress: (sent: number, total: number) => void, signal?: AbortSignal): Promise<void> {
    const { file, targetDir, relativePath } = task;
    const dir = relativePath ? joinPath(targetDir, relativePath) : targetDir;
    const size = file.size;
    const throwIfAborted = () => {
      if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    };
    throwIfAborted();

    // 이어올리기: 이 앱이 중단한 파일만. 서버 temp가 파일 전체 크기 이상이면 커밋 안 된 옛 temp로 보고 처음부터.
    let uploaded = 0;
    if (isInterrupted(file)) {
      uploaded = await this.api
        .get<{ uploadedBytes: number }>(`/api/v2.1/repos/${libId}/file-uploaded-bytes/`, { parent_dir: dir, file_name: file.name }, signal)
        .then((r) => r.uploadedBytes ?? 0)
        .catch((e) => {
          if ((e as Error).name === "AbortError") throw e;
          return 0;
        });
      if (uploaded >= size) uploaded = 0;
    }
    throwIfAborted();

    let link = await this.uploadLink(libId, targetDir, signal);
    const form = (blob: Blob) => {
      const f = new FormData();
      f.append("file", blob, file.name);
      f.append("parent_dir", targetDir);
      if (relativePath) f.append("relative_path", relativePath);
      f.append("replace", "1");
      return f;
    };
    const progress = (sent: number) => onProgress(Math.min(sent, size), size);

    const ranges = chunkRanges(size, uploaded, CHUNK_SIZE);
    if (ranges.length === 0) {
      await xhrUpload(link, form(file), {}, progress, signal);
      onProgress(size, size);
      return;
    }
    markInterrupted(file);
    // XHR 헤더는 ISO-8859-1만 허용 → 파일명은 percent-encoding (Seahub resumable과 동일)
    const disposition = `attachment; filename="${encodeURIComponent(file.name)}"`;
    for (const { start, end } of ranges) {
      throwIfAborted();
      const headers = { "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Disposition": disposition };
      const send = () => xhrUpload(link, form(file.slice(start, end + 1)), headers, (sent) => progress(start + sent), signal);
      try {
        await send();
      } catch (e) {
        // 업로드 링크 만료(403/500) → 링크 한 번 다시 받아 같은 청크 재시도
        if (signal?.aborted || !isLinkExpired(e)) throw e;
        link = await this.uploadLink(libId, targetDir, signal);
        await send();
      }
      progress(end + 1);
    }
    clearInterrupted(file);
  }

  private async uploadLink(libId: string, dir: string, signal?: AbortSignal): Promise<string> {
    const url = await this.api.get<string>(`/api2/repos/${libId}/upload-link/`, { p: dir }, signal);
    return `${url}?ret-json=1`;
  }

  async downloadUrl(libId: string, path: string): Promise<string> {
    return this.api.get<string>(`/api2/repos/${libId}/file/`, { p: path, reuse: "1" });
  }
  previewUrl(libId: string, path: string): Promise<string> {
    return this.downloadUrl(libId, path);
  }
  async readText(libId: string, path: string): Promise<string> {
    const url = await this.previewUrl(libId, path);
    const res = await fetch(url);
    if (!res.ok) throw new StorageError("server", res.statusText, res.status);
    return res.text();
  }
  async mkdir(libId: string, path: string): Promise<void> {
    await this.api.postForm(`/api2/repos/${libId}/dir/`, { operation: "mkdir" }, { p: path });
  }
  async rename(libId: string, path: string, newName: string, type: "file" | "dir"): Promise<void> {
    await this.api.postForm(`/api2/repos/${libId}/${type}/`, { operation: "rename", newname: newName }, { p: path });
  }
  async remove(libId: string, path: string, type: "file" | "dir"): Promise<void> {
    await this.api.delete(`/api2/repos/${libId}/${type}/`, { p: path });
  }
  async createShareLink(libId: string, path: string, opts?: { password?: string; expireDays?: number }): Promise<ShareLink> {
    const form: Record<string, string> = { repo_id: libId, path };
    if (opts?.password) form.password = opts.password;
    if (opts?.expireDays) form.expire_days = String(opts.expireDays);
    const res = await this.api.postForm<{ link: string; expire_date?: string }>("/api/v2.1/share-links/", form);
    const expiresAt = res.expire_date ? Date.parse(res.expire_date) / 1000 : undefined;
    return expiresAt && !Number.isNaN(expiresAt) ? { url: res.link, expiresAt } : { url: res.link };
  }
}
