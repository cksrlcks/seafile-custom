import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { openExternal } from "@/features/shell/platform";

const EXTERNAL = /^(https?:|mailto:)/i;

// 링크는 웹뷰가 아니라 기본 브라우저로. 상대 경로(다른 문서·앵커)는 갈 곳이 없어 무시한다
const components: Components = {
  a: ({ href, children }) => (
    <a
      href={href}
      title={href}
      onClick={(e) => {
        e.preventDefault();
        if (href && EXTERNAL.test(href)) openExternal(href);
      }}
    >
      {children}
    </a>
  ),
  // 문서에 박힌 data: 이미지만 그린다. 외부 이미지는 추적용일 수 있어 불러오지 않고(HTML 미리보기의 CSP와 같은 기준),
  // 상대 경로는 서버 파일이라 앱 주소로는 못 불러온다. 둘 다 대체 글만
  img: ({ src, alt }) => (typeof src === "string" && /^data:image\//i.test(src) ? <img src={src} alt={alt ?? ""} /> : alt ? <span className="text-muted-foreground">[{alt}]</span> : null),
};

/**
 * 마크다운 미리보기(GFM: 표·체크리스트·취소선). 미리보기를 열 때만 불러온다(lazy).
 * 원시 HTML은 그리지 않는다(react-markdown 기본) — 서버에서 받은 파일의 스크립트가 앱 웹뷰에서 돌면 안 된다
 */
export default function MarkdownView({ text }: { text: string }) {
  return (
    <div className="h-full w-full overflow-auto bg-card">
      <article className="prose prose-markdown mx-auto max-w-3xl px-10 py-10">
        <Markdown remarkPlugins={[remarkGfm]} components={components}>
          {text}
        </Markdown>
      </article>
    </div>
  );
}
