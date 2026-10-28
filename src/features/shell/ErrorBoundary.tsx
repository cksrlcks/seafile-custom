import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/errorLog";

interface State {
  error: Error | null;
}

/** 렌더 오류가 나도 흰 화면 대신 안내와 다시 열기 버튼을 보여 준다 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logError("render", Object.assign(error, { stack: `${error.stack ?? ""}
${info.componentStack ?? ""}` }));
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-background text-sm text-foreground">
        <div className="text-base font-semibold">문제가 발생했습니다</div>
        <pre className="max-w-lg overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">{this.state.error.message}</pre>
        <Button size="sm" onClick={() => location.reload()}>
          다시 열기
        </Button>
      </div>
    );
  }
}
