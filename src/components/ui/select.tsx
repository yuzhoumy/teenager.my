import * as React from "react";
import { cn } from "@/lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-2xl border border-border-strong bg-surface px-3 py-2 text-sm text-foreground shadow-[0_0_0_1px_var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus",
        className
      )}
      {...props}
    />
  );
}
