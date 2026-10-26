import { afterEach, describe, expect, it, vi } from "vitest";
import { SeafileProvider } from "./SeafileProvider";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => fetchMock.mockReset());

describe("SeafileProvider", () => {
  it("login stores token", async () => {
    fetchMock.mockResolvedValue(json({ token: "t1" }));
    const p = new SeafileProvider("https://host.example", null);
    await p.login("me", "pw");
    expect(p.isLoggedIn()).toBe(true);
    expect(p.token).toBe("t1");
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("https://host.example/api2/auth-token/");
  });

  it("listDir maps and sorts entries", async () => {
    fetchMock.mockResolvedValue(
      json([
        { id: "1", name: "b.txt", type: "file", size: 1, mtime: 1 },
        { id: "2", name: "a", type: "dir", size: 0, mtime: 1 },
      ]),
    );
    const p = new SeafileProvider("https://host.example", "t");
    const entries = await p.listDir("r", "/x");
    expect(entries.map((e) => e.path)).toEqual(["/x/a", "/x/b.txt"]);
    expect(entries[0].type).toBe("dir");
  });
});

describe("SeafileProvider file operations", () => {
  it("rename dir uses dir endpoint", async () => {
    fetchMock.mockResolvedValue(json("success"));
    await new SeafileProvider("https://host.example", "t").rename("r", "/a/old", "new", "dir");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://host.example/api2/repos/r/dir/?p=%2Fa%2Fold");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toBe("operation=rename&newname=new");
  });

  it("rename file uses file endpoint", async () => {
    fetchMock.mockResolvedValue(json("success"));
    await new SeafileProvider("https://host.example", "t").rename("r", "/a.txt", "b.txt", "file");
    expect(fetchMock.mock.calls[0][0]).toBe("https://host.example/api2/repos/r/file/?p=%2Fa.txt");
  });

  it("remove file uses DELETE", async () => {
    fetchMock.mockResolvedValue(json("success"));
    await new SeafileProvider("https://host.example", "t").remove("r", "/a.txt", "file");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://host.example/api2/repos/r/file/?p=%2Fa.txt");
    expect(init.method).toBe("DELETE");
  });

  it("mkdir posts operation=mkdir", async () => {
    fetchMock.mockResolvedValue(json("success"));
    await new SeafileProvider("https://host.example", "t").mkdir("r", "/new dir");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://host.example/api2/repos/r/dir/?p=%2Fnew+dir");
    expect(String(init.body)).toBe("operation=mkdir");
  });

  it("downloadUrl returns the temp link", async () => {
    fetchMock.mockResolvedValue(json("https://host.example/seafhttp/files/abc/a.txt"));
    const url = await new SeafileProvider("https://host.example", "t").downloadUrl("r", "/a.txt");
    expect(url).toBe("https://host.example/seafhttp/files/abc/a.txt");
    expect(fetchMock.mock.calls[0][0]).toBe("https://host.example/api2/repos/r/file/?p=%2Fa.txt&reuse=1");
  });
});

describe("SeafileProvider.createShareLink", () => {
  it("posts form and maps link", async () => {
    fetchMock.mockResolvedValue(json({ link: "https://x/d/abc/", expire_date: "2026-11-02T00:00:00+09:00" }));
    const res = await new SeafileProvider("https://host.example", "t").createShareLink("r", "/a.txt", { expireDays: 7 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://host.example/api/v2.1/share-links/");
    expect(String(init.body)).toBe("repo_id=r&path=%2Fa.txt&expire_days=7");
    expect(res.url).toBe("https://x/d/abc/");
    expect(typeof res.expiresAt).toBe("number");
  });

  it("omits expiresAt when server gives none", async () => {
    fetchMock.mockResolvedValue(json({ link: "https://x/d/abc/", expire_date: "" }));
    const res = await new SeafileProvider("https://host.example", "t").createShareLink("r", "/a.txt");
    expect(res.expiresAt).toBeUndefined();
    expect(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)).toBe("repo_id=r&path=%2Fa.txt");
  });
});
