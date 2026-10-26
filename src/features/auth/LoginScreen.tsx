import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/storage/StorageContext";
import { connectionFor } from "@/storage/session";
import { loginErrorMessage } from "./loginError";

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
      await login(connectionFor(baseUrl), username, password, otp || undefined);
    } catch (err) {
      const info = loginErrorMessage(err);
      setError(info.message);
      if (info.otpRequired) setOtpRequired(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-sidebar">
      <form onSubmit={submit} className="flex w-80 flex-col gap-2 rounded-lg border border-border bg-card p-6 text-sm shadow-item">
        <h1 className="mb-3 text-lg font-semibold tracking-tight">Drive</h1>
        <label className="text-2xs text-muted-foreground">서버 주소</label>
        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." required />
        <label className="text-2xs text-muted-foreground">아이디</label>
        <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />
        <label className="text-2xs text-muted-foreground">비밀번호</label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {otpRequired && (
          <>
            <label className="text-2xs text-muted-foreground">2단계 인증 코드</label>
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
