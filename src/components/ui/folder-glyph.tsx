import { cn } from "cn";

/**
 * 시안의 입체 폴더: 뒷판(진한 파랑) + 앞판(하늘→파랑 세로 그라디언트) + 상단 광택 + 아래쪽 블러 그림자.
 * 색은 --folder-* 토큰만 쓴다.
 */
export function FolderGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 80" className={cn("size-24", className)} aria-hidden>
      <defs>
        <linearGradient id="fg-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--folder-back-top)" />
          <stop offset="1" stopColor="var(--folder-back-bottom)" />
        </linearGradient>
        <linearGradient id="fg-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--folder-front-top)" />
          <stop offset="1" stopColor="var(--folder-front-bottom)" />
        </linearGradient>
        <linearGradient id="fg-gloss" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.55" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <filter id="fg-shadow" x="-20%" y="-10%" width="140%" height="150%">
          <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="var(--folder-shadow)" />
        </filter>
      </defs>
      <g filter="url(#fg-shadow)">
        {/* 뒷판 + 탭 */}
        <path d="M8 16a6 6 0 0 1 6-6h22a6 6 0 0 1 4.6 2.2l4.4 5.3H82a6 6 0 0 1 6 6v38a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6Z" fill="url(#fg-back)" />
        {/* 앞판 */}
        <path d="M8 30a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v31a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6Z" fill="url(#fg-front)" />
        {/* 광택 */}
        <path d="M8 30a6 6 0 0 1 6-6h68a6 6 0 0 1 6 6v14H8Z" fill="url(#fg-gloss)" />
        {/* 앞판 상단 얇은 하이라이트 선 */}
        <path d="M14 24.6h68" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  );
}
