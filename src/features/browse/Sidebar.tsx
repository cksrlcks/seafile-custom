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
    <aside className="flex w-56 shrink-0 flex-col gap-2 border-r border-border bg-muted/40 p-4">
      <div className="text-xs font-medium text-muted-foreground">라이브러리</div>
      <ul className="flex flex-col gap-0.5">
        {libraries?.map((lib) => (
          <li key={lib.id}>
            <Button
              variant="ghost"
              disabled={lib.encrypted}
              onClick={() => onSelect(lib.id)}
              className={cn(
                "h-8 w-full justify-start gap-2 px-2 text-sm font-normal",
                selected === lib.id && "bg-accent font-medium",
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
