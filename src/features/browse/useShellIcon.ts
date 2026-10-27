import { useQuery } from "@tanstack/react-query";
import { isTauri } from "@/features/shell/platform";
import type { Entry } from "@/storage/StorageProvider";

const supported = isTauri();

/**
 * OS 셸 아이콘(윈도우 탐색기·맥 Finder와 같은 파일/폴더 그림)을 blob URL로. 확장자·크기별로 한 번만 받아 세션 동안 캐시.
 * 브라우저이거나 아직 안 받았으면 null → 기존 SVG 아이콘을 쓴다.
 */
export function useShellIcon(entry: Entry, size: 16 | 48): string | null {
  const dir = entry.type === "dir";
  const ext = !dir && entry.name.includes(".") ? entry.name.split(".").pop()!.toLowerCase() : "";
  // 고해상도에서 흐리지 않게 실제 픽셀 크기로 요청. 셸 이미지 리스트는 48px까지만 안전하다
  const px = Math.min(48, Math.ceil(size * (window.devicePixelRatio || 1)));
  const q = useQuery({
    queryKey: ["shell-icon", dir, ext, px],
    enabled: supported,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    queryFn: async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const buf = await invoke<ArrayBuffer>("file_icon", { ext, dir, size: px });
      return URL.createObjectURL(new Blob([buf], { type: "image/png" }));
    },
  });
  return q.data ?? null;
}
