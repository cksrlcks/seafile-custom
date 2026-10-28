import { describe, expect, it } from "vitest";
import { FIT, MAX_ZOOM, fitScale, zoomAt } from "./imageView";

describe("imageView", () => {
  it("fitScale: 큰 이미지는 줄이고, 작은 이미지는 100%, 90도 회전이면 가로세로를 바꿔 계산", () => {
    expect(fitScale({ w: 2000, h: 1000 }, { w: 1000, h: 1000 }, 0)).toBe(0.5);
    expect(fitScale({ w: 200, h: 100 }, { w: 1000, h: 1000 }, 0)).toBe(1);
    expect(fitScale({ w: 2000, h: 1000 }, { w: 1000, h: 500 }, 90)).toBe(0.25);
  });

  it("zoomAt: 커서 아래 점이 제자리에 머문다", () => {
    const v = { ...FIT, x: 30, y: -10 };
    const p = { x: 100, y: 50 };
    const next = zoomAt(v, 0.5, 2, p);
    // 이미지 좌표 q = (p - off) / s 가 확대 전후로 같아야 한다
    expect((p.x - next.x) / 2).toBeCloseTo((p.x - v.x) / 0.5);
    expect((p.y - next.y) / 2).toBeCloseTo((p.y - v.y) / 0.5);
    expect(next.zoom).toBe(2);
  });

  it("zoomAt: 배율 상한을 넘지 않는다", () => {
    expect(zoomAt(FIT, 1, 1000).zoom).toBe(MAX_ZOOM);
  });
});
