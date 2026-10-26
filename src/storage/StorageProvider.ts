export interface Library {
  id: string;
  name: string;
  size: number;
  mtime: number;
  encrypted: boolean;
}

export interface Entry {
  id: string;
  name: string;
  type: "file" | "dir";
  size: number;
  mtime: number;
  /** 부모 경로 + 이름, '/'로 시작 */
  path: string;
}

export interface UploadTask {
  file: File;
  targetDir: string;
  /** 폴더 드롭 시 targetDir 아래 하위 경로 ('a/b') */
  relativePath?: string;
}

export interface ShareLink {
  url: string;
  expiresAt?: number;
}

export type StorageErrorKind = "unauthorized" | "notFound" | "network" | "server";

export class StorageError extends Error {
  constructor(
    public kind: StorageErrorKind,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

export interface Connection {
  /** "mock"은 개발·화면 확인용 (서버 없음) */
  kind: "seafile" | "mock";
  baseUrl: string;
}

export interface StorageProvider {
  /** 현재 인증 토큰. 세션 저장용. 로그인 전/로그아웃 후 null */
  readonly token: string | null;
  login(username: string, password: string, otp?: string): Promise<void>;
  logout(): Promise<void>;
  isLoggedIn(): boolean;

  listLibraries(): Promise<Library[]>;
  renameLibrary(libId: string, newName: string): Promise<void>;
  listDir(libId: string, path: string): Promise<Entry[]>;

  upload(
    libId: string,
    task: UploadTask,
    onProgress: (sent: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  /** 만료 있는 임시 URL */
  downloadUrl(libId: string, path: string): Promise<string>;
  previewUrl(libId: string, path: string): Promise<string>;
  readText(libId: string, path: string): Promise<string>;

  mkdir(libId: string, path: string): Promise<void>;
  rename(libId: string, path: string, newName: string, type: "file" | "dir"): Promise<void>;
  remove(libId: string, path: string, type: "file" | "dir"): Promise<void>;

  createShareLink(
    libId: string,
    path: string,
    opts?: { password?: string; expireDays?: number },
  ): Promise<ShareLink>;
}
