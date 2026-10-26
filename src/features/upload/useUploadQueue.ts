import { useQueryClient } from "@tanstack/react-query";
import { createContext, createElement, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useStorage } from "@/storage/StorageContext";
import { UploadQueue, type UploadItem } from "./uploadQueue";

const Ctx = createContext<UploadQueue | null>(null);

/** 앱 수명 동안 하나(Provider가 바뀌면 새로). 완료 시 해당 폴더 쿼리 무효화. */
export function UploadQueueRoot({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const qc = useQueryClient();
  const queue = useMemo(() => new UploadQueue(storage), [storage]);
  useEffect(() => {
    queue.onAllDone = (libId, dirs) => {
      for (const d of dirs) void qc.invalidateQueries({ queryKey: ["dir", libId, d] });
    };
  }, [queue, qc]);
  return createElement(Ctx.Provider, { value: queue }, children);
}

export function useUploadQueue(): { queue: UploadQueue; items: UploadItem[] } {
  const queue = useContext(Ctx);
  if (!queue) throw new Error("useUploadQueue outside UploadQueueRoot");
  const items = useSyncExternalStore(
    (fn) => queue.subscribe(fn),
    () => queue.getSnapshot(),
  );
  return { queue, items };
}
