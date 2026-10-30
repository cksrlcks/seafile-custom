import { isMac, isTauri } from "@/features/shell/platform";

/**
 * 기기별 토큰(TokenV2)용 이 PC 정보. 로그인할 때 함께 보내면 서버가 기기마다 따로 토큰을 만들어,
 * 사용자가 서버 웹의 '연결된 기기'에서 이 PC만 끊을 수 있고 로그아웃하면 서버에서도 토큰이 지워진다
 */
export interface DeviceInfo {
  platform: "mac" | "windows" | "linux";
  deviceId: string;
  deviceName: string;
  clientVersion: string;
}

const KEY = "seadrive.deviceId";

/** 설치마다 한 번 만드는 무작위 id. 서버가 데스크톱 기기 id는 40자(hex)만 받는다(아니면 400 invalid device id) */
export function deviceId(local: Storage = localStorage): string {
  const saved = local.getItem(KEY);
  if (saved && /^[0-9a-f]{40}$/.test(saved)) return saved;
  const id = Array.from(crypto.getRandomValues(new Uint8Array(20)), (b) => b.toString(16).padStart(2, "0")).join("");
  local.setItem(KEY, id);
  return id;
}

/** 앱 안에서만. 브라우저 개발 화면이면 null(예전 방식 토큰) */
export async function deviceInfo(): Promise<DeviceInfo | null> {
  if (!isTauri()) return null;
  const [{ invoke }, { getVersion }] = await Promise.all([import("@tauri-apps/api/core"), import("@tauri-apps/api/app")]);
  const [name, version] = await Promise.all([invoke<string>("device_name").catch(() => ""), getVersion()]);
  const platform = isMac() ? "mac" : /Win/i.test(navigator.userAgent) ? "windows" : "linux";
  return { platform, deviceId: deviceId(), deviceName: name || `U-Drive (${platform})`, clientVersion: version };
}
