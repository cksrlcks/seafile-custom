import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./xhrUpload", () => ({ xhrUpload: vi.fn(async () => "ok") }));
vi.mock("./chunk", async (orig) => ({ ...(await orig<typeof import("./chunk")>()), CHUNK_SIZE: 8 }));

import { SeafileProvider } from "./SeafileProvider";
import { xhrUpload } from "./xhrUpload";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);
const xhr = vi.mocked(xhrUpload);

function server(uploadedBytes: number) {
  fetchMock.mockImplementation(async (url: string) => {
    if (url.includes("file-uploaded-bytes")) return new Response(JSON.stringify({ uploadedBytes }), { status: 200 });
    if (url.includes("upload-link")) return new Response(JSON.stringify("https://host.example/seafhttp/upload-api/tok"), { status: 200 });
    return new Response("", { status: 404 });
  });
}

function fileOf(bytes: number): File {
  return new File([new Uint8Array(bytes)], "big.bin");
}

const p = () => new SeafileProvider("https://host.example", "t");
const headersOf = (call: number) => xhr.mock.calls[call][2] as Record<string, string>;

beforeEach(() => xhr.mockClear());
afterEach(() => fetchMock.mockReset());

describe("SeafileProvider.upload", () => {
  it("single post for small file", async () => {
    server(0);
    await p().upload("r", { file: fileOf(5), targetDir: "/d" }, () => {});
    expect(xhr).toHaveBeenCalledTimes(1);
    expect(xhr.mock.calls[0][0]).toBe("https://host.example/seafhttp/upload-api/tok?ret-json=1");
    expect(headersOf(0)["Content-Range"]).toBeUndefined();
    const form = xhr.mock.calls[0][1] as FormData;
    expect(form.get("parent_dir")).toBe("/d");
    expect(form.get("replace")).toBe("1");
  });

  it("resumes from uploadedBytes", async () => {
    server(8);
    await p().upload("r", { file: fileOf(20), targetDir: "/d" }, () => {});
    expect(xhr).toHaveBeenCalledTimes(2);
    expect(headersOf(0)["Content-Range"]).toBe("bytes 8-15/20");
    expect(headersOf(1)["Content-Range"]).toBe("bytes 16-19/20");
    expect(headersOf(0)["Content-Disposition"]).toBe('attachment; filename="big.bin"');
  });

  it("skips when already complete", async () => {
    server(20);
    const progress = vi.fn();
    await p().upload("r", { file: fileOf(20), targetDir: "/d" }, progress);
    expect(xhr).not.toHaveBeenCalled();
    expect(progress).toHaveBeenCalledWith(20, 20);
  });

  it("asks uploaded bytes under the relative dir", async () => {
    server(0);
    await p().upload("r", { file: fileOf(5), targetDir: "/d", relativePath: "a/b" }, () => {});
    const askUrl = fetchMock.mock.calls.find((c) => (c[0] as string).includes("file-uploaded-bytes"))![0] as string;
    expect(askUrl).toContain("parent_dir=%2Fd%2Fa%2Fb");
    expect((xhr.mock.calls[0][1] as FormData).get("relative_path")).toBe("a/b");
  });
});
