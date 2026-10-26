import { StorageError, type Entry, type Library, type ShareLink, type StorageProvider, type UploadTask } from "../StorageProvider";
import { joinPath } from "../path";
import { SeafileApi } from "./api";
import { CHUNK_SIZE, chunkRanges } from "./chunk";
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

  async listLibraries(): Promise<Library[]> {
    const repos = await this.api.get<RepoDto[]>("/api2/repos/");
    return repos.map((r) => ({ id: r.id, name: r.name, size: r.size, mtime: r.mtime, encrypted: !!r.encrypted }));
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

    const uploaded = await this.api
      .get<{ uploadedBytes: number }>(`/api/v2.1/repos/${libId}/file-uploaded-bytes/`, { parent_dir: dir, file_name: file.name })
      .then((r) => r.uploadedBytes ?? 0)
      .catch(() => 0);
    if (size > 0 && uploaded >= size) {
      onProgress(size, size);
      return;
    }

    let link = await this.uploadLink(libId, targetDir);
    const form = (blob: Blob) => {
      const f = new FormData();
      f.append("file", blob, file.name);
      f.append("parent_dir", targetDir);
      if (relativePath) f.append("relative_path", relativePath);
      f.append("replace", "1");
      return f;
    };

    const ranges = chunkRanges(size, uploaded, CHUNK_SIZE);
    if (ranges.length === 0) {
      await xhrUpload(link, form(file), {}, (sent) => onProgress(sent, size), signal);
      onProgress(size, size);
      return;
    }
    for (const { start, end } of ranges) {
      const headers = { "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Disposition": `attachment; filename="${file.name}"` };
      const send = () => xhrUpload(link, form(file.slice(start, end + 1)), headers, (sent) => onProgress(start + sent, size), signal);
      try {
        await send();
      } catch (e) {
        // 업로드 링크 만료(403/500) → 링크 한 번 다시 받아 같은 청크 재시도
        if (signal?.aborted || !isLinkExpired(e)) throw e;
        link = await this.uploadLink(libId, targetDir);
        await send();
      }
      onProgress(end + 1, size);
    }
  }

  private async uploadLink(libId: string, dir: string): Promise<string> {
    const url = await this.api.get<string>(`/api2/repos/${libId}/upload-link/`, { p: dir });
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
