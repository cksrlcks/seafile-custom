import { cn } from "cn";

/** 시안의 파란 그라디언트 물결 로고. 색은 --brand-* 토큰만. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-a)" />
          <stop offset="1" stopColor="var(--brand-b)" />
        </linearGradient>
      </defs>
      {[6, 11, 16, 21].map((y, i) => (
        <path
          key={y}
          d={`M3 ${y}c3-3 6-3 9 0s6 3 9 0 4-2 4-2`}
          fill="none"
          stroke="url(#logo-g)"
          strokeWidth="2.6"
          strokeLinecap="round"
          opacity={1 - i * 0.14}
        />
      ))}
    </svg>
  );
}
