import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { formatSize } from "@/lib/format";
import { useStorage } from "@/storage/StorageContext";

interface Props {
  itemCount: number | null;
  selectedCount: number;
  selectedBytes: number;
}

/** Finder/탐색기식 하단 상태 표시줄 24px */
export function StatusBar({ itemCount, selectedCount, selectedBytes }: Props) {
  const storage = useStorage();
  const acc = useQuery({ queryKey: ["account"], queryFn: () => storage.getAccount(), staleTime: 30_000 });
  const a = acc.data;
  return (
    <div className="flex h-6 shrink-0 items-center gap-4 border-t border-border bg-sidebar px-3 text-2xs text-muted-foreground">
      <span>{itemCount === null ? "" : `${itemCount}개 항목`}</span>
      {selectedCount > 0 && (
        <span className="text-foreground">
          {selectedCount}개 선택{selectedBytes > 0 && ` · ${formatSize(selectedBytes)}`}
        </span>
      )}
      <span className="flex-1" />
      {a && (
        <span className="flex items-center gap-2">
          {a.quota ? (
            <>
              <Progress value={Math.min(100, (a.usage / a.quota) * 100)} className="w-24" />
              <span>
                {formatSize(a.usage)} / {formatSize(a.quota)} 사용
              </span>
            </>
          ) : (
            <span>{formatSize(a.usage)} 사용</span>
          )}
        </span>
      )}
    </div>
  );
}
