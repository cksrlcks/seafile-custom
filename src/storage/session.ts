import type { Connection } from "./StorageProvider";

export interface Session {
  connection: Connection;
  token: string | null;
}

const KEY = "seadrive.session";
const DEFAULT: Session = { connection: { kind: "seafile", baseUrl: "https://seafile.heavybear-lab.net" }, token: null };

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
