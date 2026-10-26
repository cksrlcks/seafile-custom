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
