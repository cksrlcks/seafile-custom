import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { isMac, isTauri } from "./features/shell/platform";
import "./index.css";

// 맥 전용 스타일 보정(index.css의 mac: 변형)
if (isMac()) document.documentElement.dataset.os = "mac";

// 배포판 앱에서는 WebView 기본 우클릭 메뉴(새로고침·검사 등)를 막는다. 입력칸은 복사·붙여넣기 메뉴를 남긴다.
// 개발 중에는 검사 도구를 쓰도록 그대로 둔다
if (import.meta.env.PROD && isTauri()) {
  document.addEventListener("contextmenu", (e) => {
    if (!(e.target as Element | null)?.closest?.("input, textarea, [contenteditable]")) e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
