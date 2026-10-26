import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/storage/StorageContext";
import { StorageError } from "@/storage/StorageProvider";

function describe(e: unknown, setOtpRequired: (v: boolean) => void): string {
  if (!(e instanceof StorageError)) return "알 수 없는 오류가 발생했습니다";
  if (e.message === "otp required" || (e.status === 400 && /otp/i.test(e.message))) {
    setOtpRequired(true);
    return "2단계 인증 코드를 입력하세요";
  }
  switch (e.kind) {
    case "unauthorized":
      return "아이디 또는 비밀번호가 틀렸습니다";
    case "network":
      return "서버에 연결할 수 없습니다. 서버 주소와 CORS 설정을 확인하세요";
    default:
      return `서버 오류 (${e.status ?? ""})`;
  }
}

export function LoginScreen() {
  const { session, login } = useSession();
  const [baseUrl, setBaseUrl] = useState(session.connection.baseUrl);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login({ kind: "seafile", baseUrl: baseUrl.trim().replace(/\/+$/, "") }, username, password, otp || undefined);
    } catch (err) {
      setError(describe(err, setOtpRequired));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <form onSubmit={submit} className="flex w-80 flex-col gap-2 rounded-md border border-border bg-card p-4">
        <h1 className="mb-2 text-sm font-semibold">seadrive 로그인</h1>
        <label className="text-xs text-muted-foreground">서버 주소</label>
        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." required />
        <label className="text-xs text-muted-foreground">아이디</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        <label className="text-xs text-muted-foreground">비밀번호</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {otpRequired && (
          <>
            <label className="text-xs text-muted-foreground">2단계 인증 코드</label>
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" autoFocus />
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" disabled={busy} className="mt-2">
          {busy ? "로그인 중..." : "로그인"}
        </Button>
      </form>
    </div>
  );
}
