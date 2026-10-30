import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLibraries } from "@/features/browse/useCurrentDir";
import { setPrefs, useAppPrefs } from "@/features/settings/appPrefs";
import { isTauri } from "@/features/shell/platform";
import { useUploadQueue } from "@/features/upload/useUploadQueue";
import { useSession, useStorage } from "@/storage/StorageContext";
import type { Library } from "@/storage/StorageProvider";
import { listenNearby, nearby, serverReachable, startNearby, stopNearby, uploadReceived, useNearby } from "./nearby";

/** 회사 네트워크인지 다시 보는 간격. 노트북을 들고 나가면 늦어도 이만큼 뒤에 멈춘다 */
const RECHECK_MS = 60_000;

/** 서버에 닿는지(회사 네트워크인지). 처음엔 null, 이후 간격마다·네트워크가 바뀔 때마다 다시 본다 */
function useOnNetwork(server: string, enabled: boolean): boolean | null {
  const [ok, setOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const check = () => void serverReachable(server).then((v) => alive && setOk(v));
    check();
    const t = setInterval(check, RECHECK_MS);
    window.addEventListener("online", check);
    window.addEventListener("offline", check);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("online", check);
      window.removeEventListener("offline", check);
    };
  }, [server, enabled]);
  return ok;
}

/** 드라이브로 받기 기본 폴더: 내 첫 저장소의 '받은 파일'(받을 때 없으면 만든다) */
export const DEFAULT_RECEIVE_FOLDER = "/받은 파일";

export function defaultReceiveLibrary(libs: Library[]): Library | undefined {
  const writable = libs.filter((l) => !l.encrypted && !l.readOnly);
  return writable.find((l) => l.section === "내 저장소") ?? writable[0];
}

/**
 * 로그인해 있는 동안 근처에 나를 알리고 다른 U-Drive를 찾는다. 로그아웃하면 화면에서 빠지며 멈춘다.
 * 받을지는 Rust가 띄우는 구석 팝업(OfferPopup)이 묻고, 드라이브로 받은 파일은 여기서 올린다.
 */
export function NearbyRoot() {
  const storage = useStorage();
  const { session } = useSession();
  const { nearbyVisible, receiveDrive } = useAppPrefs();
  const { queue } = useUploadQueue();
  const acc = useQuery({ queryKey: ["account"], queryFn: () => storage.getAccount(), staleTime: 30_000, enabled: isTauri() });
  const libs = useLibraries();
  const name = acc.data?.name;
  const email = acc.data?.email;
  const server = session.connection.baseUrl;

  useEffect(() => {
    if (!isTauri()) return;
    const off = listenNearby();
    return () => void off.then((f) => f());
  }, []);

  // 회사 네트워크에서만 나를 알리고 받는다(카페·공항 Wi-Fi에 이름·이메일을 방송하지 않게)
  const enabled = isTauri() && nearbyVisible && !!name && !!email;
  const onNetwork = useOnNetwork(server, enabled);
  useEffect(() => nearby.setOffNetwork(enabled && onNetwork === false), [enabled, onNetwork]);
  useEffect(() => {
    if (!enabled || !onNetwork || !name || !email) return;
    void startNearby({ name, email, server });
    return () => void stopNearby();
  }, [enabled, onNetwork, name, email, server]);

  // 드라이브 폴더가 아직 없거나 지금 계정에 없는 저장소면 기본 폴더로
  useEffect(() => {
    if (!libs.data || (receiveDrive && libs.data.some((l) => l.id === receiveDrive.libId))) return;
    const lib = defaultReceiveLibrary(libs.data);
    setPrefs({ receiveDrive: lib ? { libId: lib.id, libName: lib.name, path: DEFAULT_RECEIVE_FOLDER } : null });
  }, [libs.data, receiveDrive]);

  // 드라이브로 받기가 끝난 전송을 올린다
  const { transfers } = useNearby();
  useEffect(() => {
    const read = async (path: string) => {
      const { invoke } = await import("@tauri-apps/api/core");
      return new File([await invoke<ArrayBuffer>("read_local_file", { path })], path.split(/[\\/]/).pop()!);
    };
    for (const t of transfers) {
      if (!t.send && t.status === "done" && t.upload?.length && !t.stage) void uploadReceived(t, storage, queue, read);
    }
  }, [transfers, storage, queue]);

  return null;
}
