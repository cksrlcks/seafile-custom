import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { loginErrorMessage } from "@/features/auth/loginError";
import { useSession, useStorage } from "@/storage/StorageContext";
import { connectionFor } from "@/storage/session";

interface Props {
  open: boolean;
  onClose(): void;
}

/** 설정: 서버 주소·계정 변경 = 새 정보로 다시 로그인. 비밀번호는 저장하지 않는다. */
export function SettingsDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="text-sm sm:max-w-md">{open && <Body onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function Body({ onClose }: { onClose(): void }) {
  const { session, login } = useSession();
  const storage = useStorage();
  const account = useQuery({ queryKey: ["account"], queryFn: () => storage.getAccount(), staleTime: 30_000 });
  const [baseUrl, setBaseUrl] = useState(session.connection.baseUrl);
  const [username, setUsername] = useState(account.data?.email ?? "");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const urlChanged = baseUrl.trim().replace(/\/+$/, "") !== session.connection.baseUrl;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(connectionFor(baseUrl), username, password, otp || undefined);
      onClose();
    } catch (err) {
      const info = loginErrorMessage(err);
      setError(info.message);
      if (info.otpRequired) setOtpRequired(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <DialogHeader>
        <DialogTitle>설정</DialogTitle>
        <DialogDescription>서버 주소나 계정을 바꾸면 새 정보로 다시 연결합니다.</DialogDescription>
      </DialogHeader>

      <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        현재 연결: <span className="text-foreground">{session.connection.baseUrl}</span>
        {account.data && (
          <>
            {" · "}
            <span className="text-foreground">{account.data.name}</span> ({account.data.email})
          </>
        )}
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        서버 주소
        <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        아이디
        <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" placeholder={account.data?.email ?? ""} required />
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        비밀번호
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {otpRequired && (
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          2단계 인증 코드
          <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" autoFocus />
        </label>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          취소
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "연결 중..." : urlChanged ? "저장하고 다시 연결" : "저장"}
        </Button>
      </DialogFooter>
    </form>
  );
}
