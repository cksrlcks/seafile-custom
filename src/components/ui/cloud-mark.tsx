import { cn } from "cn";

/** 로그인 엠블럼: Tabler cloud-filled 형태를 브랜드 그라디언트로 채운다 (배경 없음). 색은 --brand-* 토큰만. */
export function CloudMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-12", className)} aria-hidden>
      <defs>
        <linearGradient id="cloud-mark-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--brand-a)" />
          <stop offset="1" stopColor="var(--brand-b)" />
        </linearGradient>
      </defs>
      <path
        fill="url(#cloud-mark-g)"
        d="M10.04 4.305c2.195 -.667 4.615 -.224 6.36 1.176c1.386 1.108 2.188 2.686 2.252 4.34l.003 .212l.091 .003c2.3 .107 4.143 1.961 4.25 4.27l.004 .211c0 2.407 -1.885 4.372 -4.255 4.482l-.21 .005h-11.878l-.222 -.008c-2.94 -.11 -5.317 -2.399 -5.43 -5.263l-.005 -.216c0 -2.747 2.08 -5.01 4.784 -5.417l.114 -.016l.07 -.181c.663 -1.62 2.056 -2.906 3.829 -3.518l.244 -.08z"
      />
    </svg>
  );
}
