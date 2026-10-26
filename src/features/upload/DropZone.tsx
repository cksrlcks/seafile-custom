import { Upload } from "lucide-react";
import { type ReactNode, useImperativeHandle, type Ref } from "react";
import { useDropzone } from "react-dropzone";
import type { UploadTask } from "@/storage/StorageProvider";
import { toUploadTasks } from "./planUploads";

export interface DropZoneHandle {
  /** 헤더 [업로드] 버튼용 파일 선택 열기 */
  open(): void;
}

interface Props {
  targetDir: string;
  children: ReactNode;
  onFiles(tasks: UploadTask[]): void;
  handle?: Ref<DropZoneHandle>;
}

export function DropZone({ targetDir, children, onFiles, handle }: Props) {
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    noClick: true,
    noKeyboard: true,
    useFsAccessApi: false,
    onDrop: (files) => files.length && onFiles(toUploadTasks(files, targetDir)),
  });
  useImperativeHandle(handle, () => ({ open }), [open]);

  return (
    <div {...getRootProps({ className: "relative flex min-h-0 flex-1 flex-col outline-none" })}>
      <input {...getInputProps()} />
      {children}
      {isDragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-primary bg-background/80 text-sm">
          <Upload className="size-8 text-primary" />
          <span>
            여기에 놓으면 <span className="font-medium">{targetDir}</span> 에 업로드
          </span>
        </div>
      )}
    </div>
  );
}
