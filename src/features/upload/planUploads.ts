import type { Entry, UploadTask } from "@/storage/StorageProvider";

/** react-dropzone이 폴더 드롭 시 File에 붙이는 path('/a/b/c.txt', './a/b/c.txt', 'c.txt')에서 하위 디렉터리 부분을 뽑는다 */
export function toUploadTasks(files: File[], targetDir: string): UploadTask[] {
  return files.map((file) => {
    const p = (file as File & { path?: string }).path ?? file.name;
    const segs = p.split("/").filter((s) => s && s !== ".");
    segs.pop(); // 파일명 제거
    const relativePath = segs.join("/");
    return relativePath ? { file, targetDir, relativePath } : { file, targetDir };
  });
}

// ponytail: 상위 폴더만 검사. 하위 경로 충돌은 서버가 replace=1로 덮어씀. 필요해지면 하위 listDir 추가.
export function planUploads(tasks: UploadTask[], existing: Entry[]): { conflicts: UploadTask[]; fresh: UploadTask[] } {
  const names = new Set(existing.map((e) => e.name));
  const conflicts: UploadTask[] = [];
  const fresh: UploadTask[] = [];
  for (const t of tasks) (!t.relativePath && names.has(t.file.name) ? conflicts : fresh).push(t);
  return { conflicts, fresh };
}
