import { StorageError } from "../StorageProvider";

type Query = Record<string, string>;

export class SeafileApi {
  constructor(
    readonly baseUrl: string,
    private getToken: () => string | null,
  ) {}

  url(path: string, query?: Query): string {
    const u = this.baseUrl.replace(/\/+$/, "") + path;
    return query ? `${u}?${new URLSearchParams(query)}` : u;
  }

  async get<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T> {
    return this.request<T>("GET", path, query, undefined, undefined, signal);
  }

  async postForm<T>(path: string, form: Record<string, string>, query?: Query, headers?: Query): Promise<T> {
    return this.request<T>("POST", path, query, new URLSearchParams(form), headers);
  }

  async delete(path: string, query?: Query): Promise<void> {
    await this.request<unknown>("DELETE", path, query);
  }

  private async request<T>(method: string, path: string, query?: Query, body?: BodyInit, extra?: Query, signal?: AbortSignal): Promise<T> {
    const headers = new Headers(extra);
    const token = this.getToken();
    if (token) headers.set("Authorization", `Token ${token}`);
    headers.set("Accept", "application/json");

    let res: Response;
    try {
      // Seahub api2는 이름 변경 등 성공 시 301로 응답한다. 따라가면 CORS로 실패하므로 따라가지 않는다.
      res = await fetch(this.url(path, query), { method, headers, body, signal, redirect: "manual" });
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      throw new StorageError("network", (e as Error).message);
    }
    if (res.type === "opaqueredirect") return undefined as T;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const kind = res.status === 401 ? "unauthorized" : res.status === 404 ? "notFound" : "server";
      const err = new StorageError(kind, errorMessage(text) || res.statusText, res.status);
      if (res.headers.get("X-Seafile-OTP") === "required") err.message = "otp required";
      throw err;
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

/** Seahub 오류 본문 {"error_msg": "..."} 에서 사람이 읽을 문장만. JSON이 아니면 원문 그대로 */
function errorMessage(text: string): string {
  try {
    const j = JSON.parse(text) as { error_msg?: string; error?: string; detail?: string };
    return j.error_msg || j.error || j.detail || text;
  } catch {
    return text;
  }
}
