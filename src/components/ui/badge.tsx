import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border-strong bg-surface-muted px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-text-muted",
        className
      )}
      {...props}
    />
  );
}
