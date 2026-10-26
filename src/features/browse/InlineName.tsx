import { useState } from "react";
import { Input } from "@/components/ui/input";

/** 이름 변경·새 폴더용 인라인 입력. Enter 확정, Esc 취소, 포커스 잃으면 취소. */
export function InlineName({ initial, onSubmit, onCancel, className }: { initial: string; onSubmit(name: string): void; onCancel(): void; className?: string }) {
  const [value, setValue] = useState(initial);
  const submit = () => {
    const v = value.trim();
    if (v && v !== initial) onSubmit(v);
    else onCancel();
  };
  return (
    <Input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={(e) => {
        const dot = initial.lastIndexOf(".");
        e.target.setSelectionRange(0, dot > 0 ? dot : initial.length);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") submit();
        if (e.key === "Escape") onCancel();
      }}
      onBlur={submit}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className={className}
    />
  );
}
