import type { Entry, Library, ShareLink, StorageProvider, UploadTask } from "../StorageProvider";
import { joinPath } from "../path";
import { SeafileApi } from "./api";

interface RepoDto { id: string; name: string; size: number; mtime: number; encrypted: boolean }
interface DirentDto { id: string; name: string; type: "file" | "dir"; size?: number; mtime: number }

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

  upload(_libId: string, _task: UploadTask, _onProgress: (sent: number, total: number) => void, _signal?: AbortSignal): Promise<void> {
    throw new Error("not implemented");
  }
  downloadUrl(_libId: string, _path: string): Promise<string> {
    throw new Error("not implemented");
  }
  previewUrl(libId: string, path: string): Promise<string> {
    return this.downloadUrl(libId, path);
  }
  readText(_libId: string, _path: string): Promise<string> {
    throw new Error("not implemented");
  }
  mkdir(_libId: string, _path: string): Promise<void> {
    throw new Error("not implemented");
  }
  rename(_libId: string, _path: string, _newName: string, _type: "file" | "dir"): Promise<void> {
    throw new Error("not implemented");
  }
  remove(_libId: string, _path: string, _type: "file" | "dir"): Promise<void> {
    throw new Error("not implemented");
  }
  createShareLink(_libId: string, _path: string, _opts?: { password?: string; expireDays?: number }): Promise<ShareLink> {
    throw new Error("not implemented");
  }
}
