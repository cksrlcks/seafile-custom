import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Entry } from "@/storage/StorageProvider";

export function DeleteDialog({ entry, onConfirm, onCancel }: { entry: Entry | null; onConfirm(): void; onCancel(): void }) {
  return (
    <Dialog open={entry !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>'{entry?.name}'을(를) 삭제할까요?</DialogTitle>
          <DialogDescription>{entry?.type === "dir" ? "폴더 안의 내용도 함께 삭제됩니다." : "삭제한 파일은 서버 휴지통에서 복구할 수 있습니다."}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            취소
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
