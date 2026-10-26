import { describe, expect, it } from "vitest";
import { locationLabel } from "./FileList";

describe("locationLabel", () => {
  it("item directly under the root", () => expect(locationLabel("/", "/a.txt")).toBe("· 이 폴더"));
  it("nested under root /", () => expect(locationLabel("/", "/docs/2025/a.txt")).toBe("· docs/2025"));
  it("nested under a sub root", () => expect(locationLabel("/docs", "/docs/2025/a.txt")).toBe("· 2025"));
  it("direct child of a sub root", () => expect(locationLabel("/docs", "/docs/a.txt")).toBe("· 이 폴더"));
});
