import type { Connection } from "./StorageProvider";

export interface Session {
  connection: Connection;
  token: string | null;
}
export interface LoginPrefs {
  /** "아이디 저장"이 켜져 있으면 마지막 아이디 */
  username: string | null;
  /** 자동 로그인: 토큰을 앱을 닫아도 유지(localStorage) / 끄면 이번 실행 동안만(sessionStorage) */
  autoLogin: boolean;
}
interface Stores {
  local: Storage;
  session: Storage;
}

const KEY = "seadrive.session";
const PREFS_KEY = "seadrive.loginPrefs";
const DEFAULT: Session = { connection: { kind: "seafile", baseUrl: "https://uxis.heavybear-lab.net" }, token: null };
/** 같은 서버가 https 주소로 옮겨 갔다. 저장된 예전 주소는 새 주소로 읽는다(토큰은 같은 서버라 그대로 쓴다) */
const MOVED: Record<string, string> = { "http://192.168.1.240": DEFAULT.connection.baseUrl };
const defaultStores = (): Stores => ({ local: localStorage, session: sessionStorage });

/** 입력한 서버 주소로 Connection을 만든다. "mock"은 개발용 인메모리 백엔드. */
export function connectionFor(url: string): Connection {
  const baseUrl = url.trim().replace(/\/+$/, "");
  return { kind: baseUrl === "mock" ? "mock" : "seafile", baseUrl };
}

function parse(raw: string | null): Partial<Session> | null {
  try {
    return raw ? (JSON.parse(raw) as Partial<Session>) : null;
  } catch {
    return null;
  }
}

/** 연결 정보는 항상 localStorage. 토큰은 자동 로그인이면 localStorage, 아니면 sessionStorage에서 읽는다. */
export function loadSession(stores: Stores = defaultStores()): Session {
  const local = parse(stores.local.getItem(KEY));
  const sess = parse(stores.session.getItem(KEY));
  const connection = local?.connection?.baseUrl ? local.connection : sess?.connection?.baseUrl ? sess.connection : DEFAULT.connection;
  const moved = MOVED[connection.baseUrl.toLowerCase()];
  return { connection: moved ? { ...connection, baseUrl: moved } : connection, token: local?.token ?? sess?.token ?? null };
}

export function saveSession(s: Session, opts: { persistent?: boolean } = {}, stores: Stores = defaultStores()): void {
  const persistent = opts.persistent ?? true;
  stores.local.setItem(KEY, JSON.stringify({ connection: s.connection, token: persistent ? s.token : null }));
  if (persistent) stores.session.removeItem(KEY);
  else stores.session.setItem(KEY, JSON.stringify(s));
}

export function clearToken(stores: Stores = defaultStores()): void {
  const cur = loadSession(stores);
  stores.local.setItem(KEY, JSON.stringify({ connection: cur.connection, token: null }));
  stores.session.removeItem(KEY);
}

export function loadPrefs(local: Storage = localStorage): LoginPrefs {
  try {
    const p = JSON.parse(local.getItem(PREFS_KEY) ?? "{}") as Partial<LoginPrefs>;
    return { username: p.username ?? null, autoLogin: p.autoLogin ?? true };
  } catch {
    return { username: null, autoLogin: true };
  }
}

export function savePrefs(p: LoginPrefs, local: Storage = localStorage): void {
  local.setItem(PREFS_KEY, JSON.stringify(p));
}
