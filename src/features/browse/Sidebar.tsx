import { Library as LibraryIcon, Lock } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { Library } from "@/storage/StorageProvider";

interface Props {
  libraries: Library[] | undefined;
  selected: string | null;
  onSelect(libId: string): void;
}

export function Sidebar({ libraries, selected, onSelect }: Props) {
  return (
    <aside className="flex w-56 shrink-0 flex-col gap-2 py-2 pr-3">
      <div className="px-2 text-xs font-medium text-muted-foreground">라이브러리</div>
      <ul className="flex flex-col gap-0.5">
        {libraries?.map((lib) => (
          <li key={lib.id}>
            <Button
              variant="ghost"
              disabled={lib.encrypted}
              onClick={() => onSelect(lib.id)}
              className={cn(
                "h-9 w-full justify-start gap-2 rounded-lg px-2 text-sm font-normal text-foreground/80 hover:bg-accent",
                selected === lib.id && "bg-card font-medium text-foreground shadow-sm hover:bg-card",
                lib.encrypted && "text-muted-foreground",
              )}
              title={lib.encrypted ? "암호화 라이브러리는 지원하지 않습니다" : lib.name}
            >
              {lib.encrypted ? <Lock className="size-4" /> : <LibraryIcon className="size-4" />}
              <span className="truncate">{lib.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
