import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMemo } from "react";
import { LoginScreen } from "@/features/auth/LoginScreen";
import { Button } from "@/components/ui/button";
import { StorageError } from "@/storage/StorageProvider";
import { StorageRoot, useSession } from "@/storage/StorageContext";

function MainScreen() {
  const { logout } = useSession();
  return (
    <div className="p-4 text-sm">
      로그인됨 <Button variant="outline" size="sm" onClick={logout}>로그아웃</Button>
    </div>
  );
}

function Gate() {
  const { session, onUnauthorized } = useSession();
  const client = useMemo(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (e) => {
            if (e instanceof StorageError && e.kind === "unauthorized") onUnauthorized();
          },
        }),
        defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
      }),
    [onUnauthorized],
  );
  return <QueryClientProvider client={client}>{session.token ? <MainScreen /> : <LoginScreen />}</QueryClientProvider>;
}

export default function App() {
  return (
    <StorageRoot>
      <Gate />
    </StorageRoot>
  );
}
