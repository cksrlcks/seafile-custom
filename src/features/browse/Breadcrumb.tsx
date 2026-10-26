import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { splitPath } from "@/storage/path";

interface Props {
  libName: string | undefined;
  path: string;
  onNavigate(path: string): void;
}

export function Breadcrumb({ libName, path, onNavigate }: Props) {
  const segs = splitPath(path);
  const crumbs = [{ label: libName ?? "", to: "/" }, ...segs.map((s, i) => ({ label: s, to: "/" + segs.slice(0, i + 1).join("/") }))];
  return (
    <nav className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.to} className="flex min-w-0 items-center gap-1">
            {i > 0 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" />}
            {last ? (
              <span className="truncate font-medium">{c.label}</span>
            ) : (
              <Button variant="ghost" size="xs" onClick={() => onNavigate(c.to)} className="truncate font-normal text-muted-foreground">
                {c.label}
              </Button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
