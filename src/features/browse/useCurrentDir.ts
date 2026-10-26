import { useQuery } from "@tanstack/react-query";
import { useStorage } from "@/storage/StorageContext";

export interface Location {
  libId: string | null;
  path: string;
}

export function useLibraries() {
  const storage = useStorage();
  return useQuery({ queryKey: ["libraries"], queryFn: () => storage.listLibraries() });
}

export function useCurrentDir(loc: Location) {
  const storage = useStorage();
  return useQuery({
    queryKey: ["dir", loc.libId, loc.path],
    queryFn: () => storage.listDir(loc.libId!, loc.path),
    enabled: loc.libId !== null,
  });
}
