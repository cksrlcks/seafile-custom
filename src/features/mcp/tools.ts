import type { DownloadQueue } from "@/features/download/downloadQueue";
import type { IndexedEntry } from "@/features/search/useSearchIndex";
import type { UploadQueue } from "@/features/upload/uploadQueue";
import type { StorageProvider } from "@/storage/StorageProvider";

export interface LocalFile {
  name: string;
  path: string;
  size: number;
  mtime: number;
}

/** 도구가 쓰는 앱 기능. 로그인된 화면이 채운다(McpBridge) */
export interface ToolCtx {
  storage: StorageProvider;
  uploads: UploadQueue;
  downloads: DownloadQueue;
  searchIndex(): { entries: IndexedEntry[]; loading: boolean };
  /** 로컬 파일을 읽어 File로(이름 = 경로의 마지막 부분) */
  readLocalFile(path: string): Promise<File>;
  /** dir 안에서 name과 겹치지 않는 경로 */
  freePath(dir: string, name: string): Promise<string>;
  /** 설정의 다운로드 폴더, 없으면 OS 다운로드 폴더 */
  defaultDownloadDir(): Promise<string>;
  recentFiles(dir: string, limit: number): Promise<LocalFile[]>;
}

export interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

const str = (description: string) => ({ type: "string", description });
const LIBRARY = str("저장소 id (list_libraries의 id)");

export const TOOLS: { name: string; description: string; inputSchema: object }[] = [
  {
    name: "list_libraries",
    description: "드라이브의 저장소 목록. section이 '내 저장소'인 것이 사용자 본인 저장소다. 암호화·읽기 전용 여부도 알려준다.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "list_dir",
    description: "저장소 안 폴더의 파일·폴더 목록. 올릴 위치를 제안하기 전에 기존 구조를 볼 때 쓴다.",
    inputSchema: { type: "object", properties: { library: LIBRARY, path: str("'/'로 시작하는 폴더 경로. 루트는 '/'") }, required: ["library", "path"] },
  },
  {
    name: "search",
    description: "모든 저장소에서 이름으로 파일·폴더를 찾는다(최대 20개).",
    inputSchema: { type: "object", properties: { query: str("찾을 이름(일부)") }, required: ["query"] },
  },
  {
    name: "upload_file",
    description:
      "사용자 PC의 파일을 드라이브 폴더에 올린다. 폴더가 없으면 만든다. 같은 이름이 있으면 아무것도 올리지 않고 conflicts를 돌려준다. 반드시 사용자 확인을 받은 뒤 호출한다.",
    inputSchema: {
      type: "object",
      properties: {
        local_paths: { type: "array", items: { type: "string" }, description: "올릴 파일의 절대 경로들" },
        library: LIBRARY,
        dir: str("올릴 폴더 경로('/'로 시작)"),
        overwrite: { type: "boolean", description: "같은 이름 파일을 덮어쓴다. 사용자가 동의했을 때만 true" },
      },
      required: ["local_paths", "library", "dir"],
    },
  },
  {
    name: "upload_text",
    description: "텍스트 내용을 UTF-8 파일로 만들어 드라이브 폴더에 올린다(채팅에서 쓴 md·txt 문서용). 규칙은 upload_file과 같다.",
    inputSchema: {
      type: "object",
      properties: {
        name: str("파일 이름(확장자 포함)"),
        content: str("파일 내용"),
        library: LIBRARY,
        dir: str("올릴 폴더 경로('/'로 시작)"),
        overwrite: { type: "boolean", description: "같은 이름 파일을 덮어쓴다. 사용자가 동의했을 때만 true" },
      },
      required: ["name", "content", "library", "dir"],
    },
  },
  {
    name: "download",
    description: "드라이브 파일을 사용자 PC에 받는다(폴더는 안 됨). 같은 이름이 있으면 번호를 붙여 저장하고, 저장한 절대 경로를 돌려준다.",
    inputSchema: {
      type: "object",
      properties: {
        library: LIBRARY,
        paths: { type: "array", items: { type: "string" }, description: "받을 파일 경로들('/'로 시작)" },
        local_dir: str("저장할 로컬 폴더의 절대 경로. Claude Code면 현재 작업 폴더. 모르면 생략(다운로드 폴더에 저장)"),
      },
      required: ["library", "paths"],
    },
  },
  {
    name: "recent_downloads",
    description: "사용자 다운로드 폴더의 최근 파일(최신순). 채팅에서 만든 파일을 사용자가 받은 뒤 찾아서 올릴 때 쓴다.",
    inputSchema: { type: "object", properties: { limit: { type: "number", description: "개수(기본 10)" } } },
  },
];

export async function callTool(name: string, _args: Record<string, unknown>, _ctx: ToolCtx): Promise<ToolResult> {
  throw new Error(`알 수 없는 도구: ${name}`);
}
