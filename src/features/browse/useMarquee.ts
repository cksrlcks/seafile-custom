import { useRef, useState, type MouseEvent as RMouseEvent, type PointerEvent as RPointerEvent, type RefObject } from "react";

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 두 모서리로 사각형. 어느 방향으로 끌어도 left/top이 작은 쪽 */
export function rectFrom(ax: number, ay: number, bx: number, by: number): Rect {
  return { left: Math.min(ax, bx), top: Math.min(ay, by), width: Math.abs(ax - bx), height: Math.abs(ay - by) };
}

/** 겹치기만 하면 true(탐색기 방식). 모서리만 닿는 건 제외 */
export function intersects(r: Rect, b: { left: number; top: number; right: number; bottom: number }): boolean {
  return r.left < b.right && r.left + r.width > b.left && r.top < b.bottom && r.top + r.height > b.top;
}

const THRESHOLD = 4;

/**
 * 스크롤 컨테이너 안에서 끌면 사각형과 겹치는 [data-path] 항목을 선택한다. Ctrl/⌘를 누른 채면 기존 선택에 더한다.
 * 컨테이너는 position: relative 여야 사각형이 콘텐츠와 같이 스크롤된다. 4px 미만은 클릭으로 둔다.
 */
export function useMarquee(ref: RefObject<HTMLElement | null>, selected: Set<string>, setSelected: (s: Set<string>) => void) {
  const [rect, setRect] = useState<Rect | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const dragged = useRef(false);

  const onPointerDown = (e: RPointerEvent) => {
    const el = ref.current;
    if (!el || e.button !== 0) return;
    if ((e.target as Element).closest("thead, input, button, [contenteditable]")) return;
    const toContent = (ev: { clientX: number; clientY: number }) => {
      const box = el.getBoundingClientRect();
      return {
        x: Math.min(Math.max(ev.clientX - box.left + el.scrollLeft, 0), el.scrollWidth),
        y: Math.min(Math.max(ev.clientY - box.top + el.scrollTop, 0), el.scrollHeight),
      };
    };
    const start = toContent(e);
    const base = e.ctrlKey || e.metaKey ? new Set(selectedRef.current) : new Set<string>();
    const pointerId = e.pointerId;
    let active = false;

    const end = () => {
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", end, true);
      window.removeEventListener("pointercancel", end, true);
      if (!active) return;
      if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
      setRect(null);
      // 끌기 끝에 따라오는 click 한 번이 선택을 덮어쓰지 않도록. click은 같은 태스크에서 오므로 다음 틱에 해제
      dragged.current = true;
      setTimeout(() => (dragged.current = false), 0);
    };
    const move = (ev: PointerEvent) => {
      if (ev.buttons === 0) return end(); // 창 밖에서 버튼을 놓아 up을 못 받은 경우
      const cur = toContent(ev);
      if (!active) {
        if (Math.hypot(cur.x - start.x, cur.y - start.y) < THRESHOLD) return;
        active = true;
        el.setPointerCapture(pointerId); // 창 밖으로 나가도 move/up을 계속 받는다. 클릭을 살리려 임계값 뒤에 잡는다
      }
      const r = rectFrom(start.x, start.y, cur.x, cur.y);
      setRect(r);
      // 히트 테스트는 화면 좌표: 사각형을 스크롤·컨테이너 위치만큼 옮긴다
      const box = el.getBoundingClientRect();
      const client = { ...r, left: r.left - el.scrollLeft + box.left, top: r.top - el.scrollTop + box.top };
      const hits = [...el.querySelectorAll<HTMLElement>("[data-path]")].filter((n) => intersects(client, n.getBoundingClientRect())).map((n) => n.dataset.path!);
      setSelected(new Set([...base, ...hits]));
    };
    // capture 단계: 자식(메뉴 트리거 등)이 전파를 막아도 끝을 놓치지 않는다
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", end, true);
    window.addEventListener("pointercancel", end, true);
  };

  /** 컨테이너의 onClickCapture에 연결 */
  const onClickCapture = (e: RMouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.stopPropagation();
  };

  return { rect, onPointerDown, onClickCapture };
}
