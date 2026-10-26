import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStorage } from "@/storage/StorageContext";
import { joinPath, parentPath } from "@/storage/path";
import type { Entry } from "@/storage/StorageProvider";
import { downloadEntries } from "@/features/download/useDownloads";
import type { Location } from "./useCurrentDir";

export function useEntryActions(loc: Location) {
  const storage = useStorage();
  const qc = useQueryClient();
  const libId = loc.libId!;
  const refresh = (path: string) => qc.invalidateQueries({ queryKey: ["dir", libId, path] });

  const mkdir = useMutation({
    mutationFn: (name: string) => storage.mkdir(libId, joinPath(loc.path, name)),
    onSuccess: () => refresh(loc.path),
  });
  const rename = useMutation({
    mutationFn: ({ entry, newName }: { entry: Entry; newName: string }) => storage.rename(libId, entry.path, newName, entry.type),
    onSuccess: (_d, { entry }) => refresh(parentPath(entry.path)),
  });
  const remove = useMutation({
    mutationFn: (entry: Entry) => storage.remove(libId, entry.path, entry.type),
    onSuccess: (_d, entry) => {
      void refresh(parentPath(entry.path));
      void qc.invalidateQueries({ queryKey: ["account"] });
    },
  });
  /** 파일 1개는 저장 위치 선택, 여러 개는 폴더 선택. 실제 전송은 다운로드 패널에서 진행 */
  const download = useMutation({
    mutationFn: (entries: Entry[]) => downloadEntries(entries, (e) => storage.downloadUrl(libId, e.path)),
  });

  const labels = { mkdir: "새 폴더를 만들지 못했습니다", rename: "이름을 바꾸지 못했습니다", remove: "삭제하지 못했습니다", download: "다운로드를 시작하지 못했습니다" };
  const failed = ([["mkdir", mkdir], ["rename", rename], ["remove", remove], ["download", download]] as const).find(([, m]) => m.error);
  const error = failed ? { message: labels[failed[0]], detail: (failed[1].error as Error).message, reset: () => failed[1].reset() } : null;

  return { mkdir, rename, remove, download, error };
}
