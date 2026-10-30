import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useLibraries } from "@/features/browse/useCurrentDir";
import { setPrefs, useAppPrefs } from "@/features/settings/appPrefs";
import { isTauri } from "@/features/shell/platform";
import { useUploadQueue } from "@/features/upload/useUploadQueue";
import { useSession, useStorage } from "@/storage/StorageContext";
import type { Library } from "@/storage/StorageProvider";
import { listenNearby, startNearby, stopNearby, uploadReceived, useNearby } from "./nearby";

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

  useEffect(() => {
    if (!isTauri() || !nearbyVisible || !name || !email) return;
    void startNearby({ name, email, server });
    return () => void stopNearby();
  }, [nearbyVisible, name, email, server]);

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
