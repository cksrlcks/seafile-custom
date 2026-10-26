import { Button } from "@/components/ui/button";
import { splitPath } from "@/storage/path";

interface Props {
  libName: string | undefined;
  path: string;
  onNavigate(path: string): void;
}

/** 시안: 15px 회색 텍스트, 작은 점 구분자. 마지막 항목도 회색. */
export function Breadcrumb({ libName, path, onNavigate }: Props) {
  const segs = splitPath(path);
  const crumbs = [{ label: libName ?? "", to: "/" }, ...segs.map((s, i) => ({ label: s, to: "/" + segs.slice(0, i + 1).join("/") }))];
  return (
    <nav className="flex min-w-0 items-center text-md text-muted-foreground">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={c.to} className="flex min-w-0 items-center">
            {i > 0 && <span className="mx-2 text-caption leading-none opacity-70">·</span>}
            {last ? (
              <span className="truncate">{c.label}</span>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => onNavigate(c.to)} className="-mx-1.5 h-7 truncate px-1.5 text-md font-normal text-muted-foreground hover:text-foreground">
                {c.label}
              </Button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
