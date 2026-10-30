/**
 * Claude가 넘긴 PC 경로를 다뤄도 되는지. 공유 문서에 심긴 지시(프롬프트 인젝션)로 비밀 파일(~/.ssh, 브라우저 프로필 등)을
 * 드라이브에 올리거나, 로그인할 때 실행되는 폴더(LaunchAgents, 시작프로그램)·.git/hooks에 파일을 쓰지 못하게 한다.
 * 막히면 사유 문구, 괜찮으면 null
 */
export function blockedLocalPath(path: string): string | null {
  const p = normalize(path);
  if (p === null) return `절대 경로가 아닙니다: ${path}`;
  if (p.startsWith("//")) return `네트워크 경로는 다룰 수 없습니다: ${path}`;
  const parts = p.split("/").filter(Boolean);
  if (parts.some((s) => s.startsWith("."))) return `숨김 파일·폴더(.으로 시작)는 보안상 다룰 수 없습니다: ${path}`;
  const lower = p.toLowerCase();
  const under = (dir: string) => lower === dir || lower.startsWith(`${dir}/`);
  // 윈도우: 드라이브 문자 뒤만 본다
  const win = /^[a-z]:\//.test(lower) ? lower.slice(2) : null;
  const blocked = win
    ? parts.some((s) => s.toLowerCase() === "appdata") || ["/windows", "/program files", "/program files (x86)", "/programdata"].some((d) => win === d || win.startsWith(`${d}/`))
    : /^\/users\/[^/]+\/library(\/|$)/.test(lower) || UNIX_SYSTEM.some(under);
  return blocked ? `시스템·앱 설정 폴더(~/Library, AppData 등)는 보안상 다룰 수 없습니다: ${path}` : null;
}

const UNIX_SYSTEM = ["/system", "/library", "/bin", "/sbin", "/usr", "/etc", "/private/etc", "/var/root", "/private/var/root", "/dev", "/proc", "/sys", "/boot", "/root"];

/** 구분자를 /로 바꾸고 .·..를 풀어 쓴다. 절대 경로가 아니면 null. UNC(\\server)는 //로 시작한다 */
function normalize(path: string): string | null {
  const s = path.trim().replace(/\\/g, "/");
  const drive = /^[a-zA-Z]:\//.exec(s)?.[0];
  const unc = !drive && s.startsWith("//");
  if (!drive && !s.startsWith("/")) return null;
  const out: string[] = [];
  for (const seg of s.slice(drive ? 3 : unc ? 2 : 1).split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") out.pop();
    else out.push(seg);
  }
  return (drive ?? (unc ? "//" : "/")) + out.join("/");
}

/** Claude가 준 파일 이름에서 경로 부분을 뗀다(../ 등으로 다른 폴더에 쓰지 못하게). 쓸 수 없는 이름이면 null */
export function plainFileName(name: string): string | null {
  const base = name.split(/[\\/]/).pop()!.trim();
  return base && base !== "." && base !== ".." ? base : null;
}
