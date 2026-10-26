import type { Connection, StorageProvider } from "./StorageProvider";
import { SeafileProvider } from "./seafile/SeafileProvider";

export function createProvider(conn: Connection, token?: string | null): StorageProvider {
  switch (conn.kind) {
    case "seafile":
      return new SeafileProvider(conn.baseUrl, token ?? null);
  }
}
