/** 알림 맨 위 그림 배경(새 버전 알림·파일 수신 팝업). 그라디언트 위에 feTurbulence 노이즈를 겹친다 */
const NOISE = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E")`;

export const COVER = {
  backgroundColor: "var(--primary)",
  backgroundImage: [
    NOISE,
    "radial-gradient(at 15% 20%, oklch(0.85 0.12 250) 0, transparent 55%)",
    "radial-gradient(at 85% 25%, oklch(0.72 0.17 310) 0, transparent 50%)",
    "radial-gradient(at 60% 100%, oklch(0.82 0.13 190) 0, transparent 60%)",
  ].join(", "),
  backgroundBlendMode: "overlay, normal, normal, normal",
};
