export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
export const isMac = () => /Mac/i.test(navigator.platform) || /Mac OS/i.test(navigator.userAgent);
/** Windows에서만 창 버튼을 직접 그린다(decorations: false). macOS는 신호등 버튼이 남아 있다. */
export const showWindowControls = () => isTauri() && !isMac();
export const modKey = () => (isMac() ? "⌘" : "Ctrl");
