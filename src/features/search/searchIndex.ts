/** 이름에 query가 들어가는 항목. 앞부분 일치 → 짧은 이름 순. 대소문자 무시 */
export function searchEntries<T extends { name: string }>(entries: T[], query: string, limit = 50): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: { e: T; rank: number }[] = [];
  for (const e of entries) {
    const n = e.name.toLowerCase();
    const i = n.indexOf(q);
    if (i < 0) continue;
    hits.push({ e, rank: (i === 0 ? 0 : 1_000_000) + n.length });
  }
  return hits
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((h) => h.e);
}
