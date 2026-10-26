import { describe, expect, it } from "vitest";
import { clearToken, loadSession, saveSession } from "./session";

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: () => null,
    get length() {
      return m.size;
    },
  };
}

describe("session", () => {
  it("loadSession returns default when empty", () => {
    expect(loadSession({ local: memStorage(), session: memStorage() })).toEqual({
      connection: { kind: "seafile", baseUrl: "https://seafile.heavybear-lab.net" },
      token: null,
    });
  });

  it("saveSession then loadSession round-trips", () => {
    const s = { local: memStorage(), session: memStorage() };
    saveSession({ connection: { kind: "seafile", baseUrl: "https://x" }, token: "t" }, {}, s);
    expect(loadSession(s)).toEqual({ connection: { kind: "seafile", baseUrl: "https://x" }, token: "t" });
  });

  it("clearToken keeps connection", () => {
    const s = { local: memStorage(), session: memStorage() };
    saveSession({ connection: { kind: "seafile", baseUrl: "https://x" }, token: "t" }, {}, s);
    clearToken(s);
    expect(loadSession(s)).toEqual({ connection: { kind: "seafile", baseUrl: "https://x" }, token: null });
  });
});

describe("session persistence modes", () => {
  it("keeps the token only for the session when autoLogin is off", () => {
    const local = memStorage();
    const session = memStorage();
    saveSession({ connection: { kind: "seafile", baseUrl: "https://x" }, token: "t" }, { persistent: false }, { local, session });
    expect(loadSession({ local, session }).token).toBe("t");
    expect(local.getItem("seadrive.session")).not.toContain('"t"');
    // 앱을 다시 열면(sessionStorage 비어 있음) 토큰이 없다
    expect(loadSession({ local, session: memStorage() }).token).toBeNull();
  });

  it("remembers the username independently of the token", async () => {
    const { loadPrefs, savePrefs } = await import("./session");
    const local = memStorage();
    savePrefs({ username: "me@x.com", autoLogin: false }, local);
    expect(loadPrefs(local)).toEqual({ username: "me@x.com", autoLogin: false });
    expect(loadPrefs(memStorage())).toEqual({ username: null, autoLogin: true });
  });
});
