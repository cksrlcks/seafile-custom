import { StorageError } from "../StorageProvider";

/** multipart POST with upload progress. fetch는 업로드 진행률을 주지 않아 XHR 사용. */
export function xhrUpload(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress: (sent: number) => void,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.responseText);
      else reject(new StorageError(xhr.status === 401 ? "unauthorized" : "server", xhr.responseText || xhr.statusText, xhr.status));
    };
    xhr.onerror = () => reject(new StorageError("network", "upload failed"));
    xhr.onabort = () => reject(new DOMException("aborted", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
