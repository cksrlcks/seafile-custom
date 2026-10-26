import { afterEach, describe, expect, it, vi } from "vitest";
import { SeafileApi } from "./api";
import { StorageError } from "../StorageProvider";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function api(token: string | null = "abc") {
  return new SeafileApi("https://host.example", () => token);
}

afterEach(() => fetchMock.mockReset());

describe("SeafileApi", () => {
  it("encodes path in query", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
    await api().get("/api2/repos/x/dir/", { p: "/a b#c&d" });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toBe("https://host.example/api2/repos/x/dir/?p=%2Fa+b%23c%26d");
  });

  it("sends token header", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
    await api().get("/api2/repos/");
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("Authorization")).toBe("Token abc");
  });

  it("maps 401 to unauthorized", async () => {
    fetchMock.mockResolvedValue(new Response("", { status: 401 }));
    const err = (await api().get("/api2/repos/").catch((e) => e)) as StorageError;
    expect(err).toBeInstanceOf(StorageError);
    expect(err.kind).toBe("unauthorized");
  });

  it("treats a redirect after a successful write as success (does not follow it)", async () => {
    fetchMock.mockResolvedValue({ type: "opaqueredirect", ok: false, status: 0, headers: new Headers(), text: async () => "" } as unknown as Response);
    await expect(api().postForm("/api2/repos/r/file/", { operation: "rename", newname: "b" }, { p: "/a" })).resolves.toBeUndefined();
    expect((fetchMock.mock.calls[0][1] as RequestInit).redirect).toBe("manual");
  });

  it("uses error_msg from a JSON error body as the message", async () => {
    fetchMock.mockResolvedValue(new Response('{"error_msg": "Password is too short."}', { status: 400 }));
    const err = (await api().postForm("/api/v2.1/share-links/", { path: "/a" }).catch((e) => e)) as StorageError;
    expect(err.message).toBe("Password is too short.");
    expect(err.status).toBe(400);
  });

  it("maps fetch failure to network", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const err = (await api().get("/api2/repos/").catch((e) => e)) as StorageError;
    expect(err.kind).toBe("network");
  });
});
