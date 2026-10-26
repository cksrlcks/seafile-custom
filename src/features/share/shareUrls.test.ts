import { describe, expect, it } from "vitest";
import { directDownloadUrl } from "./shareUrls";

describe("directDownloadUrl", () => {
  it("appends dl=1 to a share link", () => expect(directDownloadUrl("https://x/f/abc/")).toBe("https://x/f/abc/?dl=1"));
  it("uses & when a query already exists", () => expect(directDownloadUrl("https://x/f/abc/?a=1")).toBe("https://x/f/abc/?a=1&dl=1"));
  it("does not duplicate", () => expect(directDownloadUrl("https://x/f/abc/?dl=1")).toBe("https://x/f/abc/?dl=1"));
});
