/** 파일·폴더 이름 검사. 문제 없으면 null, 있으면 사용자에게 보여 줄 문구. */
export function validateName(raw: string, existing: string[] = []): string | null {
  const name = raw.trim();
  if (!name) return "이름을 입력하세요";
  if (name.includes("/") || name.includes("\\")) return "이름에 / 또는 \\ 를 쓸 수 없습니다";
  if (name === "." || name === "..") return "사용할 수 없는 이름입니다";
  if (existing.includes(name)) return "같은 이름이 이미 있습니다";
  return null;
}
