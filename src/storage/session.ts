import type { Connection } from "./StorageProvider";

export interface Session {
  connection: Connection;
  token: string | null;
}

const KEY = "seadrive.session";
const DEFAULT: Session = { connection: { kind: "seafile", baseUrl: "https://seafile.heavybear-lab.net" }, token: null };

/** 입력한 서버 주소로 Connection을 만든다. "mock"은 개발용 인메모리 백엔드. */
export function connectionFor(url: string): Connection {
  const baseUrl = url.trim().replace(/\/+$/, "");
  return { kind: baseUrl === "mock" ? "mock" : "seafile", baseUrl };
}

export function loadSession(storage: Storage = localStorage): Session {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return DEFAULT;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (!parsed.connection?.baseUrl) return DEFAULT;
    return { connection: parsed.connection, token: parsed.token ?? null };
  } catch {
    return DEFAULT;
  }
}

export function saveSession(s: Session, storage: Storage = localStorage): void {
  storage.setItem(KEY, JSON.stringify(s));
}

export function clearToken(storage: Storage = localStorage): void {
  saveSession({ ...loadSession(storage), token: null }, storage);
}
