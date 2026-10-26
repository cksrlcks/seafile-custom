import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStorage } from "@/storage/StorageContext";
import { joinPath, parentPath } from "@/storage/path";
import type { Entry } from "@/storage/StorageProvider";
import type { Location } from "./useCurrentDir";

const isTauri = () => "__TAURI_INTERNALS__" in window;

/** Tauri WebView2의 window.open은 다운로드를 보장하지 않아 시스템 브라우저로 넘긴다. 브라우저 모드는 <a download>. */
async function openDownload(url: string, name: string) {
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

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
    onSuccess: (_d, entry) => refresh(parentPath(entry.path)),
  });
  const download = useMutation({
    mutationFn: async (entry: Entry) => openDownload(await storage.downloadUrl(libId, entry.path), entry.name),
  });

  const labels = { mkdir: "새 폴더를 만들지 못했습니다", rename: "이름을 바꾸지 못했습니다", remove: "삭제하지 못했습니다", download: "다운로드 링크를 받지 못했습니다" };
  const failed = ([["mkdir", mkdir], ["rename", rename], ["remove", remove], ["download", download]] as const).find(([, m]) => m.error);
  const error = failed ? { message: labels[failed[0]], detail: (failed[1].error as Error).message, reset: () => failed[1].reset() } : null;

  return { mkdir, rename, remove, download, error };
}
