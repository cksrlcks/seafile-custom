import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useStorage } from "@/storage/StorageContext";
import type { Entry } from "@/storage/StorageProvider";
import { searchTree } from "./searchTree";

export interface SearchState {
  active: boolean;
  results: Entry[];
  scanned: number;
  done: boolean;
  truncated: boolean;
}

const IDLE: SearchState = { active: false, results: [], scanned: 0, done: true, truncated: false };

/** 검색어가 있으면 root 아래를 순회하며 결과를 쌓는다. 폴더 목록은 ["dir", libId, path] 캐시를 같이 쓴다. */
export function useRecursiveSearch(libId: string | null, root: string, query: string): SearchState {
  const qc = useQueryClient();
  const storage = useStorage();
  const [state, setState] = useState<SearchState>(IDLE);

  useEffect(() => {
    const q = query.trim();
    if (!libId || !q) {
      setState(IDLE);
      return;
    }
    const ctrl = new AbortController();
    const live = (fn: (s: SearchState) => SearchState) => !ctrl.signal.aborted && setState(fn);
    // 입력이 멈춘 뒤 시작 (타이핑마다 순회하지 않게)
    const t = setTimeout(() => {
      setState({ active: true, results: [], scanned: 0, done: false, truncated: false });
      const list = (path: string) => qc.fetchQuery({ queryKey: ["dir", libId, path], queryFn: () => storage.listDir(libId, path), staleTime: 60_000 });
      void searchTree(list, root, q, (m) => live((s) => ({ ...s, results: [...s.results, ...m] })), {
        signal: ctrl.signal,
        onProgress: (n) => live((s) => ({ ...s, scanned: n })),
      }).then((r) => live((s) => ({ ...s, done: true, truncated: r.truncated })));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [libId, root, query, qc, storage]);

  return state;
}
