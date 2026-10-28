import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** useState + localStorage 기억(JSON). 읽기·쓰기에 실패하면 기본값으로 이번 세션만 유지 */
export function useStoredState<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const [v, setV] = useState<T>(() => {
    try {
      const s = localStorage.getItem(key);
      return s === null ? initial : (JSON.parse(s) as T);
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      // 저장 못 해도 이번 세션 동안은 유지된다
    }
  }, [key, v]);
  return [v, setV];
}
