/** 파일·폴더 이름 검사. 문제 없으면 null, 있으면 사용자에게 보여 줄 문구. */
export function validateName(raw: string, existing: string[] = []): string | null {
  const name = raw.trim();
  if (!name) return "이름을 입력하세요";
  if (name.includes("/") || name.includes("\\")) return "이름에 / 또는 \\ 를 쓸 수 없습니다";
  if (name === "." || name === "..") return "사용할 수 없는 이름입니다";
  if (existing.includes(name)) return "같은 이름이 이미 있습니다";
  return null;
}

/** 겹치지 않는 이름. base가 있으면 탐색기처럼 "base (2)", "base (3)"… */
export function uniqueName(base: string, existing: string[]): string {
  if (!existing.includes(base)) return base;
  let n = 2;
  while (existing.includes(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

export type NameAction = { action: "cancel" } | { action: "stay" } | { action: "submit"; name: string };

/**
 * 인라인 이름 입력을 확정할 때 할 일.
 * 이름 바꾸기(create=false)는 그대로면 취소, 새로 만들기(create=true)는 기본 이름 그대로도 만든다.
 */
export function resolveName(raw: string, initial: string, existing: string[], create: boolean): NameAction {
  const name = raw.trim();
  if (!name || (name === initial && !create)) return { action: "cancel" };
  if (validateName(name, existing)) return { action: "stay" };
  return { action: "submit", name };
}
