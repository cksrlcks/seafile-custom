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
    expect(loadSession(memStorage())).toEqual({
      connection: { kind: "seafile", baseUrl: "https://seafile.heavybear-lab.net" },
      token: null,
    });
  });

  it("saveSession then loadSession round-trips", () => {
    const s = memStorage();
    saveSession({ connection: { kind: "seafile", baseUrl: "https://x" }, token: "t" }, s);
    expect(loadSession(s)).toEqual({ connection: { kind: "seafile", baseUrl: "https://x" }, token: "t" });
  });

  it("clearToken keeps connection", () => {
    const s = memStorage();
    saveSession({ connection: { kind: "seafile", baseUrl: "https://x" }, token: "t" }, s);
    clearToken(s);
    expect(loadSession(s)).toEqual({ connection: { kind: "seafile", baseUrl: "https://x" }, token: null });
  });
});
