import { useQueries } from "@tanstack/react-query";
import { useLibraries } from "@/features/browse/useCurrentDir";
import { useStorage } from "@/storage/StorageContext";
import type { Entry } from "@/storage/StorageProvider";

export interface IndexedEntry extends Entry {
  libId: string;
}

const KEY = (libId: string) => `seadrive.index.${libId}`;

function load(libId: string, commit: string): Entry[] | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY(libId)) ?? "null") as { commit: string; entries: Entry[] } | null;
    return c && c.commit === commit ? c.entries : null;
  } catch {
    return null;
  }
}

function save(libId: string, commit: string, entries: Entry[]) {
  try {
    localStorage.setItem(KEY(libId), JSON.stringify({ commit, entries }));
  } catch {
    // shortcut: localStorage 용량(약 5MB)을 넘는 큰 저장소는 캐시 없이 매번 받는다. 자주 걸리면 IndexedDB로
  }
}

const combine = (rs: { data?: IndexedEntry[]; isPending: boolean; isError: boolean }[]) => ({
  entries: rs.flatMap((r) => r.data ?? []),
  loading: rs.some((r) => r.isPending),
  failed: rs.filter((r) => r.isError).length,
});

/**
 * 전 저장소의 파일·폴더 목록(통합 검색용). 저장소마다 headCommitId를 쿼리 키로 써서
 * 내용이 바뀐 저장소만 다시 받고, 같으면 localStorage 캐시를 쓴다. 암호화 저장소는 제외.
 */
export function useSearchIndex() {
  const storage = useStorage();
  const libs = (useLibraries().data ?? []).filter((l) => !l.encrypted);
  return useQueries({
    queries: libs.map((lib) => ({
      queryKey: ["tree", lib.id, lib.headCommitId ?? ""],
      queryFn: async (): Promise<IndexedEntry[]> => {
        const commit = lib.headCommitId ?? "";
        let entries = commit ? load(lib.id, commit) : null;
        if (!entries) {
          entries = await storage.listTree(lib.id);
          if (commit) save(lib.id, commit, entries);
        }
        return entries.map((e) => ({ ...e, libId: lib.id }));
      },
      staleTime: Infinity,
      gcTime: Infinity,
      retry: 1,
    })),
    combine,
  });
}
