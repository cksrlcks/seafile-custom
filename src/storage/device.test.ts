import { describe, expect, it } from "vitest";
import { deviceId } from "./device";

function memStorage(): Storage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k), clear: () => m.clear(), key: () => null, length: 0 };
}

describe("deviceId", () => {
  it("만들어 두고 다음에도 같은 값을 쓴다", () => {
    const s = memStorage();
    const id = deviceId(s);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(deviceId(s)).toBe(id);
    expect(deviceId(memStorage())).not.toBe(id);
  });
});
