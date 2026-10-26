import type { Entry } from "@/storage/StorageProvider";

interface Opts {
  signal?: AbortSignal;
  /** 동시에 읽을 폴더 수. 라즈베리파이 서버에 부담이 덜 가도록 작게 */
  concurrency?: number;
  /** 이 개수만큼 폴더를 읽으면 멈춘다 */
  maxDirs?: number;
  onProgress?(scanned: number): void;
}

/**
 * 서버 쪽 검색이 없는 백엔드용 클라이언트 순회 검색.
 * root부터 너비 우선으로 폴더를 읽으며 이름에 query가 들어간 항목을 찾는 대로 onMatch로 내보낸다.
 * 읽기 실패한 폴더는 건너뛴다.
 */
// ponytail: 폴더마다 목록 API 1회. 폴더가 수천 개면 느리다 — 서버 검색 API가 생기면 Provider.search로 교체.
export async function searchTree(
  list: (path: string) => Promise<Entry[]>,
  root: string,
  query: string,
  onMatch: (matches: Entry[]) => void,
  opts: Opts = {},
): Promise<{ scanned: number; truncated: boolean }> {
  const { signal, concurrency = 4, maxDirs = 2000, onProgress } = opts;
  const q = query.trim().toLowerCase();
  const queue = [root];
  let scanned = 0;
  let started = 0;
  let truncated = false;

  async function worker() {
    for (;;) {
      if (signal?.aborted) return;
      const path = queue.shift();
      if (path === undefined) return;
      if (started >= maxDirs) {
        truncated = true;
        return;
      }
      started++;
      let entries: Entry[];
      try {
        entries = await list(path);
      } catch {
        entries = [];
      }
      if (signal?.aborted) return;
      scanned++;
      onProgress?.(scanned);
      const matches = entries.filter((e) => e.name.toLowerCase().includes(q));
      if (matches.length) onMatch(matches);
      for (const e of entries) if (e.type === "dir") queue.push(e.path);
    }
  }

  // 큐가 비어 있다가 다른 워커가 하위 폴더를 넣을 수 있으므로, 모든 워커가 끝날 때까지 다시 돌린다
  while (queue.length && !signal?.aborted && !truncated) {
    await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  }
  if (queue.length && started >= maxDirs) truncated = true;
  return { scanned, truncated };
}
