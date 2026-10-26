import { useState } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { validateName } from "./validateName";

interface Props {
  initial: string;
  /** 현재 폴더의 다른 이름들 (중복 검사용) */
  existing?: string[];
  onSubmit(name: string): void;
  onCancel(): void;
  className?: string;
}

/** 이름 변경·새 폴더용 인라인 입력. Enter 확정, Esc 취소, 포커스 잃으면 확정 시도. 잘못된 이름은 빨간 테두리 + 문구. */
export function InlineName({ initial, existing = [], onSubmit, onCancel, className }: Props) {
  const [value, setValue] = useState(initial);
  const error = value.trim() === initial ? null : validateName(value, existing);
  const submit = () => {
    const v = value.trim();
    if (!v || v === initial) return onCancel();
    if (validateName(v, existing)) return; // 잘못된 이름이면 입력 상태 유지
    onSubmit(v);
  };
  return (
    <div className="relative w-full">
      <Input
        autoFocus
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(e) => setValue(e.target.value)}
        onFocus={(e) => {
          const dot = initial.lastIndexOf(".");
          e.target.setSelectionRange(0, dot > 0 ? dot : initial.length);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
          if (e.key === "Escape") onCancel();
        }}
        onBlur={() => (error ? onCancel() : submit())}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn("bg-card", className)}
      />
      {error && <div className="absolute top-full left-0 z-20 mt-1 rounded-md bg-destructive px-2 py-1 text-caption text-primary-foreground shadow-item">{error}</div>}
    </div>
  );
}
