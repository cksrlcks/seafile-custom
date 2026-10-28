import { describe, expect, it } from "vitest";
import { handleLine, INSTRUCTIONS } from "./protocol";

const call = async (msg: object) => JSON.parse((await handleLine(JSON.stringify({ jsonrpc: "2.0", ...msg }), null, "1.2.3"))!);

describe("handleLine", () => {
  it("initialize echoes protocolVersion and includes instructions", async () => {
    const r = await call({ id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "0" } } });
    expect(r.id).toBe(1);
    expect(r.result.protocolVersion).toBe("2025-11-25");
    expect(r.result.capabilities).toEqual({ tools: {} });
    expect(r.result.serverInfo).toEqual({ name: "drive", version: "1.2.3" });
    expect(r.result.instructions).toBe(INSTRUCTIONS);
  });

  it("tools/list returns the 7 tool names", async () => {
    const r = await call({ id: 2, method: "tools/list" });
    expect(r.result.tools.map((t: { name: string }) => t.name)).toEqual(["list_libraries", "list_dir", "search", "upload_file", "upload_text", "download", "recent_downloads"]);
  });

  it("tools/call without ctx returns login error", async () => {
    const r = await call({ id: 3, method: "tools/call", params: { name: "list_libraries", arguments: {} } });
    expect(r.result).toEqual({ content: [{ type: "text", text: "Drive 앱에서 로그인해 주세요." }], isError: true });
  });

  it("notifications return null", async () => {
    expect(await handleLine(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), null, "1")).toBeNull();
  });

  it("ping returns empty result", async () => {
    expect((await call({ id: 4, method: "ping" })).result).toEqual({});
  });

  it("unknown method → -32601, bad json → -32700", async () => {
    expect((await call({ id: 5, method: "nope" })).error.code).toBe(-32601);
    const bad = JSON.parse((await handleLine("{oops", null, "1"))!);
    expect(bad).toMatchObject({ id: null, error: { code: -32700 } });
  });
});
