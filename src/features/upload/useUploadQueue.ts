import { useQueryClient } from "@tanstack/react-query";
import { createContext, createElement, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { useSession, useStorage } from "@/storage/StorageContext";
import { UploadQueue, type UploadItem } from "./uploadQueue";

const Ctx = createContext<UploadQueue | null>(null);

/** 앱 수명 동안 하나(Provider가 바뀌면 새로). 완료 시 해당 폴더 쿼리 무효화, 401이면 로그인 화면으로. */
export function UploadQueueRoot({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const { onUnauthorized } = useSession();
  const qc = useQueryClient();
  const queue = useMemo(() => new UploadQueue(storage), [storage]);
  useEffect(() => {
    queue.onAllDone = (libId, dirs) => {
      for (const d of dirs) void qc.invalidateQueries({ queryKey: ["dir", libId, d] });
      void qc.invalidateQueries({ queryKey: ["account"] });
    };
    queue.onUnauthorized = () => {
      queue.cancelAll();
      onUnauthorized();
    };
    return () => queue.cancelAll(); // Provider 교체(로그아웃)되면 진행 중 XHR 중단
  }, [queue, qc, onUnauthorized]);
  return createElement(Ctx.Provider, { value: queue }, children);
}

export function useUploadQueue(): { queue: UploadQueue; items: UploadItem[] } {
  const queue = useContext(Ctx);
  if (!queue) throw new Error("useUploadQueue outside UploadQueueRoot");
  const items = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  return { queue, items };
}
