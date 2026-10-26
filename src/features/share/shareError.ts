import { StorageError } from "@/storage/StorageProvider";

/** 서버가 "이미 있음"으로 거절했는가. 이때는 기존 링크를 찾아 보여 준다 */
export const isAlreadyExists = (e: unknown) => e instanceof Error && /already exists/i.test(e.message);

/** 공유 링크 생성 실패를 사용자 문구로. 알려진 서버 문구는 우리말로, 모르는 문구는 원문을 덧붙인다 */
export function shareErrorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  const body = m.toLowerCase();
  if (isAlreadyExists(e)) return "이미 이 파일의 공유 링크가 있습니다";
  if (/too short/.test(body)) return "비밀번호가 서버가 정한 최소 길이보다 짧습니다";
  if (/too weak|strength/.test(body)) return "비밀번호가 서버 정책보다 단순합니다. 숫자·대소문자·기호를 섞어 주세요";
  if (/permission denied/.test(body)) return "이 파일을 공유할 권한이 없습니다";
  if (/expire/.test(body)) return "만료일이 서버가 허용하는 범위를 벗어났습니다";
  if (e instanceof StorageError && e.kind === "network") return "서버에 연결할 수 없습니다";
  return m ? `링크를 만들지 못했습니다: ${m}` : "링크를 만들지 못했습니다";
}
