import * as React from "react";
import { cn } from "@/lib/utils";

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500",
        className
      )}
      {...props}
    />
  );
}
