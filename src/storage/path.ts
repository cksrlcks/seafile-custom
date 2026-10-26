export function joinPath(dir: string, name: string): string {
  return dir.endsWith("/") ? dir + name : `${dir}/${name}`;
}

export function splitPath(p: string): string[] {
  return p.split("/").filter(Boolean);
}

export function parentPath(p: string): string {
  const segs = splitPath(p);
  segs.pop();
  return "/" + segs.join("/");
}

export function baseName(p: string): string {
  return splitPath(p).pop() ?? "";
}
