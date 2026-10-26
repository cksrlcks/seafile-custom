import { IconChevronDown, IconChevronUp, IconCloud } from "@tabler/icons-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useSession } from "@/storage/StorageContext";
import { connectionFor, loadPrefs, savePrefs } from "@/storage/session";
import { loginErrorMessage } from "./loginError";

export function LoginScreen() {
  const { session, login } = useSession();
  const prefs = loadPrefs();
  const [baseUrl, setBaseUrl] = useState(session.connection.baseUrl);
  const [showServer, setShowServer] = useState(false);
  const [username, setUsername] = useState(prefs.username ?? "");
  const [password, setPassword] = useState("");
  const [rememberId, setRememberId] = useState(prefs.username !== null);
  const [autoLogin, setAutoLogin] = useState(prefs.autoLogin);
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      savePrefs({ username: rememberId ? username : null, autoLogin });
      await login(connectionFor(baseUrl), username, password, otp || undefined, { persistent: autoLogin });
    } catch (err) {
      const info = loginErrorMessage(err);
      setError(info.message);
      if (info.otpRequired) setOtpRequired(true);
    } finally {
      setBusy(false);
    }
  }

  const host = baseUrl.replace(/^https?:\/\//, "");

  return (
    <div className="flex h-screen items-center justify-center bg-linear-to-b from-background to-sidebar">
      <form onSubmit={submit} className="flex w-88 flex-col gap-4 rounded-xl border border-border bg-card p-8 text-sm shadow-float">
        <div className="flex flex-col items-center gap-2 pb-2">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <IconCloud className="size-7" stroke={1.75} />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Drive</h1>
          <p className="text-xs text-muted-foreground">내 서버의 파일을 열고 올립니다</p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">아이디</span>
          <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder="이메일" className="h-9" required autoFocus={!prefs.username} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">비밀번호</span>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="h-9" required autoFocus={!!prefs.username} />
        </label>
        {otpRequired && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium">2단계 인증 코드</span>
            <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" className="h-9" autoFocus />
          </label>
        )}

        <div className="flex items-center gap-5 text-xs">
          <label className="flex cursor-default items-center gap-2">
            <Checkbox checked={rememberId} onCheckedChange={(v) => setRememberId(!!v)} />
            아이디 저장
          </label>
          <label className="flex cursor-default items-center gap-2">
            <Checkbox checked={autoLogin} onCheckedChange={(v) => setAutoLogin(!!v)} />
            자동 로그인
          </label>
        </div>

        {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}

        <Button type="submit" disabled={busy} className="h-9 w-full">
          {busy ? "로그인 중..." : "로그인"}
        </Button>

        <div className="-mb-2 flex flex-col gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <button type="button" onClick={() => setShowServer((v) => !v)} className="flex items-center justify-between rounded px-1 py-0.5 hover:text-foreground">
            <span className="truncate">
              서버 <span className="text-foreground">{host}</span>
            </span>
            {showServer ? <IconChevronUp className="size-3.5" /> : <IconChevronDown className="size-3.5" />}
          </button>
          {showServer && <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." className="h-8 md:text-xs" required />}
        </div>
      </form>
    </div>
  );
}
