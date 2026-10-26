import { useSyncExternalStore } from "react";
import { isTauri } from "@/features/shell/platform";
import type { Entry } from "@/storage/StorageProvider";
import { DownloadQueue, type DownloadItem, type Saver } from "./downloadQueue";

/** Tauri: upload 플러그인이 디스크로 스트리밍(대용량도 메모리에 안 올림). 진행 이벤트는 100ms에 한 번만 반영. */
const tauriSaver: Saver = async (url, path, onProgress) => {
  const { download } = await import("@tauri-apps/plugin-upload");
  let last = 0;
  await download(url, path, (p) => {
    const now = performance.now();
    if (now - last < 100) return;
    last = now;
    onProgress(p.progressTotal, p.total);
  });
};

/** 앱 전체에서 하나. 업로드 큐와 달리 저장소(Provider)와 무관하게 로컬 디스크 작업이라 전역으로 둔다. */
export const downloads = new DownloadQueue(tauriSaver);

export function useDownloads(): DownloadItem[] {
  return useSyncExternalStore(downloads.subscribe, downloads.getSnapshot);
}

/** 브라우저 모드: 브라우저 다운로드로 넘긴다 */
function browserDownload(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * 파일 1개면 "다른 이름으로 저장", 여러 개면 폴더 선택 후 그 폴더에 같은 이름으로 받는다.
 * 사용자가 대화상자를 취소하면 아무것도 하지 않는다(false 반환).
 */
export async function downloadEntries(entries: Entry[], getUrl: (e: Entry) => Promise<string>): Promise<boolean> {
  const files = entries.filter((e) => e.type === "file");
  if (files.length === 0) return false;

  if (!isTauri()) {
    for (const f of files) browserDownload(await getUrl(f), f.name);
    return true;
  }

  const { save, open } = await import("@tauri-apps/plugin-dialog");
  const { join, downloadDir } = await import("@tauri-apps/api/path");
  const base = await downloadDir().catch(() => undefined);

  let targets: string[];
  if (files.length === 1) {
    const path = await save({ title: "다른 이름으로 저장", defaultPath: base ? await join(base, files[0].name) : files[0].name });
    if (!path) return false;
    targets = [path];
  } else {
    const dir = await open({ title: `${files.length}개 파일을 저장할 폴더`, directory: true, defaultPath: base });
    if (!dir || Array.isArray(dir)) return false;
    targets = await Promise.all(files.map((f) => join(dir, f.name)));
  }

  downloads.add(files.map((f, i) => ({ name: f.name, size: f.size, url: () => getUrl(f), path: targets[i] })));
  return true;
}

export async function revealInFolder(path: string) {
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}
