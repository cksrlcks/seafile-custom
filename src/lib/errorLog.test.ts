import { describe, expect, it } from "vitest";
import { formatEntry } from "./errorLog";

describe("formatEntry", () => {
  it("masks tokens and link ids", () => {
    const at = new Date("2026-10-28T00:00:00Z");
    const line = formatEntry("server", `GET /files/${"a1".repeat(20)}/x.txt failed, share 0f8fad5b-d9cb-469f-a165-70867728950e`, at);
    expect(line).toBe("[2026-10-28T00:00:00.000Z] (server) GET /files/<가림>/x.txt failed, share <가림>");
  });

  it("indents the stack under the message", () => {
    const e = Object.assign(new Error("boom"), { stack: "Error: boom\n  at f" });
    expect(formatEntry("render", e).split("\n").slice(1)).toEqual(["    Error: boom", "      at f"]);
  });
});
