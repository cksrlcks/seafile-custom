/** 이미지 뷰어 확대·이동·회전 상태. x·y는 무대 중심에서 이미지 중심까지의 화면 px */
export interface View {
  /** null = 창에 맞춤 */
  zoom: number | null;
  rot: number;
  x: number;
  y: number;
}
export interface Size {
  w: number;
  h: number;
}

export const FIT: View = { zoom: null, rot: 0, x: 0, y: 0 };
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 16;

/** 창에 맞춤 배율. 작은 이미지는 키우지 않는다(100%) */
export function fitScale(img: Size, stage: Size, rot: number): number {
  const [w, h] = rot % 180 ? [img.h, img.w] : [img.w, img.h];
  return Math.min(1, stage.w / w, stage.h / h);
}

/** 화면의 점 p(무대 중심 기준)가 같은 자리에 머물도록 배율을 from → to로 바꾼다 */
export function zoomAt(v: View, from: number, to: number, p = { x: 0, y: 0 }): View {
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, to));
  const k = z / from;
  return { ...v, zoom: z, x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k };
}
