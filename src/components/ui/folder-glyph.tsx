import { cn } from "cn";

/** 참고 시안의 광택 파란 폴더. 색은 --folder-top/--folder-bottom 토큰만 사용. */
export function FolderGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 52" className={cn("size-16", className)} aria-hidden>
      <defs>
        <linearGradient id="folder-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--folder-top)" />
          <stop offset="1" stopColor="var(--folder-bottom)" />
        </linearGradient>
        <linearGradient id="folder-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.55" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M4 10a4 4 0 0 1 4-4h14l5 5h29a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" fill="var(--folder-bottom)" opacity="0.85" />
      <path d="M4 18a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4Z" fill="url(#folder-body)" />
      <path d="M4 18a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v10H4Z" fill="url(#folder-gloss)" />
    </svg>
  );
}
