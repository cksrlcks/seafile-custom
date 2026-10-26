import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { createProvider } from "./createProvider";
import { clearToken, loadSession, saveSession, type Session } from "./session";
import type { Connection, StorageProvider } from "./StorageProvider";

interface SessionApi {
  session: Session;
  login(conn: Connection, username: string, password: string, otp?: string, opts?: { persistent?: boolean }): Promise<void>;
  logout(): void;
  onUnauthorized(): void;
}

const ProviderCtx = createContext<StorageProvider | null>(null);
const SessionCtx = createContext<SessionApi | null>(null);

export function StorageRoot({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>(() => loadSession());
  const provider = useMemo(() => createProvider(session.connection, session.token), [session]);

  const login = useCallback(async (conn: Connection, username: string, password: string, otp?: string, opts?: { persistent?: boolean }) => {
    const p = createProvider(conn, null);
    await p.login(username, password, otp);
    const next: Session = { connection: conn, token: p.token };
    saveSession(next, opts);
    setSession(next);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setSession(loadSession());
  }, []);

  const api = useMemo<SessionApi>(() => ({ session, login, logout, onUnauthorized: logout }), [session, login, logout]);

  return (
    <SessionCtx.Provider value={api}>
      <ProviderCtx.Provider value={provider}>{children}</ProviderCtx.Provider>
    </SessionCtx.Provider>
  );
}

export function useStorage(): StorageProvider {
  const p = useContext(ProviderCtx);
  if (!p) throw new Error("useStorage outside StorageRoot");
  return p;
}

export function useSession(): SessionApi {
  const s = useContext(SessionCtx);
  if (!s) throw new Error("useSession outside StorageRoot");
  return s;
}
