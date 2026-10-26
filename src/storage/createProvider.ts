import type { Connection, StorageProvider } from "./StorageProvider";

export function createProvider(conn: Connection, _token?: string | null): StorageProvider {
  switch (conn.kind) {
    default:
      throw new Error(`not implemented: ${conn.kind}`);
  }
}
