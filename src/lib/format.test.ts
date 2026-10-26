import { describe, expect, it } from "vitest";
import { formatDate, formatSize } from "./format";

describe("formatSize", () => {
  it("zero", () => expect(formatSize(0)).toBe("0 B"));
  it("kilobytes", () => expect(formatSize(1536)).toBe("1.5 KB"));
  it("megabytes", () => expect(formatSize(3_355_443)).toBe("3.2 MB"));
  it("gigabytes", () => expect(formatSize(2_147_483_648)).toBe("2.0 GB"));
});

describe("formatDate", () => {
  it("formats local YYYY-MM-DD HH:mm", () => {
    const d = new Date(2026, 9, 26, 9, 5);
    expect(formatDate(d.getTime() / 1000)).toBe("2026-10-26 09:05");
  });
});

describe("formatDateLong", () => {
  it("formats Korean long date with weekday", async () => {
    const { formatDateLong } = await import("./format");
    const d = new Date(2025, 7, 25, 9, 0);
    expect(formatDateLong(d.getTime() / 1000)).toBe("2025년 8월 25일 (월)");
  });
});
