interface Source<T> {
  subscribe(fn: (items: T[]) => void): () => void;
  getSnapshot(): T[];
}

/** 큐(업로드·다운로드)의 ids 항목이 모두 끝날 때까지 기다린다. ids 순서대로 마지막 상태를 돌려준다 */
export function waitSettled<T extends { id: string; status: string }>(src: Source<T>, ids: string[], settled: (status: T["status"]) => boolean): Promise<T[]> {
  return new Promise((resolve) => {
    let off: (() => void) | undefined;
    const check = (items: T[]) => {
      const found = ids.map((id) => items.find((i) => i.id === id));
      if (!found.every((i) => i && settled(i.status))) return false;
      off?.();
      resolve(found as T[]);
      return true;
    };
    if (!check(src.getSnapshot())) off = src.subscribe(check);
  });
}
