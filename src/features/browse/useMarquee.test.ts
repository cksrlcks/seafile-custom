import { describe, expect, it } from "vitest";
import { intersects, rectFrom } from "./useMarquee";

describe("marquee", () => {
  it("normalizes any two corners", () => {
    expect(rectFrom(10, 30, 2, 5)).toEqual({ left: 2, top: 5, width: 8, height: 25 });
  });

  it("selects rows the rectangle touches, not only those it contains", () => {
    const r = rectFrom(0, 10, 50, 40);
    expect(intersects(r, { left: 0, top: 0, right: 100, bottom: 20 })).toBe(true); // 일부만 겹침
    expect(intersects(r, { left: 0, top: 40, right: 100, bottom: 60 })).toBe(false); // 모서리만 닿음
    expect(intersects(r, { left: 60, top: 10, right: 100, bottom: 40 })).toBe(false); // 옆
  });
});
