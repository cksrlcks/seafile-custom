import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useStorage } from "@/storage/StorageContext";
import { joinPath, parentPath } from "@/storage/path";
import type { Entry } from "@/storage/StorageProvider";
import type { Location } from "./useCurrentDir";

export function useEntryActions(loc: Location) {
  const storage = useStorage();
  const qc = useQueryClient();
  const libId = loc.libId!;
  const refresh = (path: string) => qc.invalidateQueries({ queryKey: ["dir", libId, path] });

  const mkdir = useMutation({
    mutationFn: (name: string) => storage.mkdir(libId, joinPath(loc.path, name)),
    onSuccess: () => refresh(loc.path),
  });
  const rename = useMutation({
    mutationFn: ({ entry, newName }: { entry: Entry; newName: string }) => storage.rename(libId, entry.path, newName, entry.type),
    onSuccess: (_d, { entry }) => refresh(parentPath(entry.path)),
  });
  const remove = useMutation({
    mutationFn: (entry: Entry) => storage.remove(libId, entry.path, entry.type),
    onSuccess: (_d, entry) => refresh(parentPath(entry.path)),
  });
  const download = useMutation({
    mutationFn: async (entry: Entry) => {
      const url = await storage.downloadUrl(libId, entry.path);
      window.open(url, "_blank");
    },
  });

  return { mkdir, rename, remove, download };
}
