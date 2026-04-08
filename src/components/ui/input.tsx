import * as React from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-10 w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
        className
      )}
      {...props}
    />
  );
}
