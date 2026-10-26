import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type OverwriteChoice = "overwrite" | "skip" | "cancel";

interface Props {
  count: number;
  onChoice(c: OverwriteChoice): void;
}

export function OverwriteDialog({ count, onChoice }: Props) {
  return (
    <Dialog open={count > 0} onOpenChange={(open) => !open && onChoice("cancel")}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{count}개 파일이 이미 있습니다</DialogTitle>
          <DialogDescription>같은 이름의 파일을 덮어쓸까요, 건너뛸까요?</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onChoice("cancel")}>
            취소
          </Button>
          <Button variant="secondary" onClick={() => onChoice("skip")}>
            건너뛰기
          </Button>
          <Button onClick={() => onChoice("overwrite")}>덮어쓰기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
