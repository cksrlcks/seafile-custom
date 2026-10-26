import { Folder, Lock, Waves } from "lucide-react";
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
    <aside className="flex w-60 shrink-0 flex-col gap-4 px-3 py-3">
      <div className="flex h-9 items-center gap-2 px-2">
        <Waves className="size-6 text-primary" />
        <span className="text-base font-semibold tracking-tight">seadrive</span>
      </div>
      <div className="px-2 text-sm text-muted-foreground">라이브러리</div>
      <ul className="flex flex-col gap-1">
        {libraries?.map((lib) => (
          <li key={lib.id}>
            <Button
              variant="ghost"
              disabled={lib.encrypted}
              onClick={() => onSelect(lib.id)}
              className={cn(
                "h-10 w-full justify-start gap-3 rounded-xl px-3 text-sm font-normal text-foreground/80 hover:bg-accent",
                selected === lib.id && "bg-card font-medium text-foreground shadow-sm hover:bg-card",
                lib.encrypted && "text-muted-foreground",
              )}
              title={lib.encrypted ? "암호화 라이브러리는 지원하지 않습니다" : lib.name}
            >
              {lib.encrypted ? <Lock className="size-4" /> : <Folder className="size-4" />}
              <span className="truncate">{lib.name}</span>
            </Button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
