import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAppPrefs } from "@/features/settings/appPrefs";
import { isTauri } from "@/features/shell/platform";
import { useSession, useStorage } from "@/storage/StorageContext";
import { listenNearby, startNearby, stopNearby } from "./nearby";

/**
 * 로그인해 있는 동안 근처에 나를 알리고 다른 U-Drive를 찾는다. 로그아웃하면 화면에서 빠지며 멈춘다.
 * 누가 보내면 받을지는 메인 창이 아니라 Rust가 띄우는 구석 팝업(OfferPopup)이 묻는다.
 */
export function NearbyRoot() {
  const storage = useStorage();
  const { session } = useSession();
  const { nearbyVisible } = useAppPrefs();
  const acc = useQuery({ queryKey: ["account"], queryFn: () => storage.getAccount(), staleTime: 30_000, enabled: isTauri() });
  const name = acc.data?.name;
  const email = acc.data?.email;
  const server = session.connection.baseUrl;

  useEffect(() => {
    if (!isTauri()) return;
    const off = listenNearby();
    return () => void off.then((f) => f());
  }, []);

  useEffect(() => {
    if (!isTauri() || !nearbyVisible || !name || !email) return;
    void startNearby({ name, email, server });
    return () => void stopNearby();
  }, [nearbyVisible, name, email, server]);

  return null;
}
