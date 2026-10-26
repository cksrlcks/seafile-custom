/** 공유 페이지를 거치지 않고 바로 다운로드가 시작되는 링크 (파일 링크에만 의미 있음) */
export function directDownloadUrl(url: string): string {
  if (/[?&]dl=1(&|$)/.test(url)) return url;
  return url + (url.includes("?") ? "&" : "?") + "dl=1";
}
