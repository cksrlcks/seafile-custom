/**
 * 공유 링크 비밀번호 규칙. Seahub settings.py 기본값:
 *   SHARE_LINK_PASSWORD_MIN_LENGTH = 10
 *   SHARE_LINK_PASSWORD_STRENGTH_LEVEL = 1  (숫자·대문자·소문자·기호 네 종류 중 몇 종류 이상)
 * 서버 관리자가 값을 바꿨으면 여기 검사를 통과해도 서버가 거절하며, 그 문구는 그대로 표시된다.
 */
export const SHARE_LINK_PASSWORD_MIN_LENGTH = 10;
export const SHARE_LINK_PASSWORD_STRENGTH_LEVEL = 1;

/** 비밀번호에 섞인 문자 종류 수 (Seahub get_password_strength_level과 같은 기준) */
export function strengthLevel(pw: string): number {
  return [/[0-9]/, /[A-Z]/, /[a-z]/, /[^0-9A-Za-z]/].filter((re) => re.test(pw)).length;
}

/** 규칙 위반이면 안내 문구, 비어 있거나 통과면 null */
export function passwordProblem(pw: string): string | null {
  if (!pw) return null;
  if (pw.length < SHARE_LINK_PASSWORD_MIN_LENGTH) return `비밀번호는 ${SHARE_LINK_PASSWORD_MIN_LENGTH}자 이상이어야 합니다`;
  if (strengthLevel(pw) < SHARE_LINK_PASSWORD_STRENGTH_LEVEL) return `숫자·대문자·소문자·기호 중 ${SHARE_LINK_PASSWORD_STRENGTH_LEVEL}종류 이상을 섞어야 합니다`;
  return null;
}
