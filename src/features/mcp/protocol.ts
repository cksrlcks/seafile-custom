import { StorageError } from "@/storage/StorageProvider";
import { callTool, TOOLS, type ToolCtx, type ToolResult } from "./tools";

/** initialize 응답으로 Claude에게 주는 안내. Claude의 행동(먼저 묻기·위치 제안·확인 후 업로드)은 이것으로 유도한다 */
export const INSTRUCTIONS = [
  "U-Drive는 사용자 PC의 U-Drive 앱에 로그인된 드라이브에 파일을 올리고 받는 도구다. 구글 드라이브가 아니다.",
  "사용자가 'U-Drive', 'u-drive', 'udrive', 'U드라이브', '유드라이브', '회사 드라이브'라고 하면(띄어쓰기·대소문자 무관) 묻지 말고 이 도구를 쓴다. 그냥 '드라이브'라고만 했고 구글 드라이브 같은 다른 드라이브 도구도 있으면, 먼저 'U-Drive와 구글 드라이브 중 어디로 할까요?'라고 묻는다. 다른 드라이브 도구가 없으면 묻지 않고 이 도구를 쓴다.",
  "사용자가 드라이브에 올려 달라고 말할 때만 올린다. 문서를 다 썼다고 해서 먼저 '드라이브에 올릴까요?'라고 묻지 않는다.",
  "올리기 전에 list_libraries와 list_dir로 사용자 본인 저장소(section '내 저장소')의 기존 폴더 구조를 보고, 그에 맞는 폴더 경로를 제안한다. 새 폴더가 필요하면 '이 폴더를 만들어서 올릴까요?'라고 말한다.",
  "사용자가 확인하기 전에는 절대 upload_file·upload_text를 호출하지 않는다.",
  "응답에 conflicts가 있으면 같은 이름 파일을 덮어쓸지 사용자에게 묻고, 동의할 때만 overwrite: true로 다시 호출한다.",
  "받기(download)는 현재 작업 폴더를 알면(Claude Code) 그 절대 경로를 local_dir로 넘기고, 모르면 생략한다.",
  "사용자가 파일을 이름으로 말하면 search로 찾고, 후보가 여럿이면 어떤 것인지 사용자에게 묻는다.",
  "올릴 파일이 사용자 PC가 아니라 Claude 작업 공간(채팅에서 만든 docx·pdf·이미지 등)에 있으면, 사용자에게 다운로드를 시키지 말고 직접 올린다. md·txt 같은 텍스트 문서는 upload_text로 올린다. 그 밖의 파일은 작업 공간에서 파일의 base64와 sha256을 구해 upload_base64로 올린다. 파일이 1MB보다 크거나 upload_base64가 계속 실패할 때만, '파일의 다운로드 버튼을 눌러 받아 주세요'라고 요청하고 사용자가 받았다고 하면 recent_downloads로 그 파일을 찾아 upload_file로 올린다.",
].join("\n");

const LOGIN: ToolResult = { content: [{ type: "text", text: "U-Drive 앱에서 로그인해 주세요." }], isError: true };

interface Request {
  id?: string | number | null;
  method?: string;
  params?: { protocolVersion?: string; name?: string; arguments?: Record<string, unknown> };
}

const reply = (id: Request["id"], body: { result: unknown } | { error: { code: number; message: string } }) => JSON.stringify({ jsonrpc: "2.0", id: id ?? null, ...body });

/** MCP JSON-RPC 한 줄을 처리해 응답 줄을 돌려준다. 알림(id 없음)이면 null. ctx가 null이면 로그인 전 */
export async function handleLine(line: string, ctx: ToolCtx | null, appVersion: string): Promise<string | null> {
  let req: Request;
  try {
    req = JSON.parse(line) as Request;
  } catch {
    return reply(null, { error: { code: -32700, message: "Parse error" } });
  }
  if (req.id === undefined || req.id === null) return null;
  switch (req.method) {
    case "initialize":
      return reply(req.id, {
        result: {
          protocolVersion: req.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "u-drive", version: appVersion },
          instructions: INSTRUCTIONS,
        },
      });
    case "ping":
      return reply(req.id, { result: {} });
    case "tools/list":
      return reply(req.id, { result: { tools: TOOLS } });
    case "tools/call":
      return reply(req.id, { result: ctx ? await runTool(req.params?.name ?? "", req.params?.arguments ?? {}, ctx) : LOGIN });
    default:
      return reply(req.id, { error: { code: -32601, message: `Method not found: ${req.method}` } });
  }
}

async function runTool(name: string, args: Record<string, unknown>, ctx: ToolCtx): Promise<ToolResult> {
  try {
    return await callTool(name, args, ctx);
  } catch (e) {
    if (e instanceof StorageError && e.kind === "unauthorized") return LOGIN;
    return { content: [{ type: "text", text: String(e) }], isError: true };
  }
}
