import { IconSearch } from "@tabler/icons-react";
import { cn } from "cn";
import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { EntryIcon } from "@/features/browse/FileList";
import { useLibraries } from "@/features/browse/useCurrentDir";
import { parentPath } from "@/storage/path";
import type { Entry } from "@/storage/StorageProvider";
import { searchEntries } from "./searchIndex";
import { useSearchIndex, type IndexedEntry } from "./useSearchIndex";

type Props = {
  onPick(libId: string, entry: Entry): void;
  disabled?: boolean;
};

/** 툴바 통합 검색: 모든 저장소에서 이름으로 찾고, 고르면 그 위치로 이동한다. ↑↓·Enter·Esc */
export function SearchBox({ onPick, disabled }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const index = useSearchIndex();
  const libs = useLibraries().data ?? [];
  const results = useMemo(() => searchEntries(index.entries, q), [index.entries, q]);
  useEffect(() => setCursor(0), [q]);

  const pick = (r: IndexedEntry) => {
    onPick(r.libId, r);
    setQ("");
    setOpen(false);
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") (e.preventDefault(), setCursor((c) => Math.min(results.length - 1, c + 1)));
    else if (e.key === "ArrowUp") (e.preventDefault(), setCursor((c) => Math.max(0, c - 1)));
    else if (e.key === "Enter" && results[cursor]) pick(results[cursor]);
    else if (e.key === "Escape") (setQ(""), setOpen(false));
  };
  const where = (r: IndexedEntry) => {
    const lib = libs.find((l) => l.id === r.libId)?.name ?? "";
    const parent = parentPath(r.path);
    return parent === "/" ? lib : `${lib} › ${parent.slice(1).split("/").join(" › ")}`;
  };

  return (
    <div className="relative mx-1 w-52 shrink-0">
      <IconSearch className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" stroke={1.75} />
      <Input
        value={q}
        onChange={(e) => (setQ(e.target.value), setOpen(true))}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        placeholder="검색"
        disabled={disabled}
        className="h-7 rounded-md pl-7 text-sm md:text-sm"
      />
      {open && q.trim() !== "" && (
        // mousedown 기본 동작을 막아 결과를 누를 때 입력창 blur로 먼저 닫히지 않게 한다
        <div onMouseDown={(e) => e.preventDefault()} className="absolute top-full right-0 z-50 mt-1 max-h-96 w-lg overflow-auto rounded-xl border border-border bg-popover py-1 text-sm shadow-float animate-in fade-in-0 slide-in-from-top-1 duration-100">
          <div className="px-3 py-1 text-2xs text-muted-foreground">
            {index.loading ? "인덱스 만드는 중… " : ""}
            {results.length}개 결과{index.failed ? ` · 저장소 ${index.failed}개는 읽지 못함` : ""}
          </div>
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">일치하는 항목이 없습니다</div>
          ) : (
            results.map((r, i) => (
              <button key={`${r.libId}:${r.path}`} type="button" onClick={() => pick(r)} onMouseEnter={() => setCursor(i)} className={cn("flex w-full items-center gap-2 px-3 py-1.5 text-left", i === cursor && "bg-accent")}>
                <EntryIcon entry={r} />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="max-w-56 shrink-0 truncate text-2xs text-muted-foreground">{where(r)}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
