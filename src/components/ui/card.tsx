import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-[28px] border border-border bg-surface p-6 shadow-[0_4px_24px_var(--shadow)]",
        className,
      )}
      {...props}
    />
  );
}
