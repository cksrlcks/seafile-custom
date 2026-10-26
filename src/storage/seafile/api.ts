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

  async get<T>(path: string, query?: Query): Promise<T> {
    return this.request<T>("GET", path, query);
  }

  async postForm<T>(path: string, form: Record<string, string>, query?: Query, headers?: Query): Promise<T> {
    return this.request<T>("POST", path, query, new URLSearchParams(form), headers);
  }

  async delete(path: string, query?: Query): Promise<void> {
    await this.request<unknown>("DELETE", path, query);
  }

  private async request<T>(method: string, path: string, query?: Query, body?: BodyInit, extra?: Query): Promise<T> {
    const headers = new Headers(extra);
    const token = this.getToken();
    if (token) headers.set("Authorization", `Token ${token}`);
    headers.set("Accept", "application/json");

    let res: Response;
    try {
      res = await fetch(this.url(path, query), { method, headers, body });
    } catch (e) {
      throw new StorageError("network", (e as Error).message);
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const kind = res.status === 401 ? "unauthorized" : res.status === 404 ? "notFound" : "server";
      const err = new StorageError(kind, text || res.statusText, res.status);
      if (res.headers.get("X-Seafile-OTP") === "required") err.message = "otp required";
      throw err;
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}
