import { useQuery } from "@tanstack/react-query";
import { Cloud } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { formatSize } from "@/lib/format";
import { useStorage } from "@/storage/StorageContext";

/** 사이드바 하단: 사용량 / 총용량 (참고 시안의 저장 공간 카드) */
export function StorageCard() {
  const storage = useStorage();
  const q = useQuery({ queryKey: ["account"], queryFn: () => storage.getAccount(), staleTime: 30_000 });
  if (!q.data) return null;
  const { usage, quota } = q.data;
  const pct = quota ? Math.min(100, (usage / quota) * 100) : 0;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-item">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Cloud className="size-4 text-primary" /> 저장 공간
      </div>
      {quota ? (
        <>
          <Progress value={pct} />
          <div className="text-caption text-muted-foreground">
            <span className="font-medium text-foreground">{formatSize(usage)}</span> / {formatSize(quota)} 사용 ({Math.round(pct)}%)
          </div>
        </>
      ) : (
        <div className="text-caption text-muted-foreground">
          <span className="font-medium text-foreground">{formatSize(usage)}</span> 사용 · 제한 없음
        </div>
      )}
    </div>
  );
}
