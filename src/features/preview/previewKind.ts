export type PreviewKind = "image" | "text" | "pdf";

const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"]);
const TEXT = new Set([
  "txt", "md", "markdown", "json", "js", "ts", "tsx", "jsx", "css", "html", "htm", "xml", "yml", "yaml", "toml", "ini", "log", "sh", "py", "rs", "go", "java", "c", "cpp", "h",
]);

export function previewKind(name: string): PreviewKind | null {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return null;
  const ext = name.slice(dot + 1).toLowerCase();
  if (IMAGE.has(ext)) return "image";
  if (TEXT.has(ext)) return "text";
  if (ext === "pdf") return "pdf";
  return null;
}
