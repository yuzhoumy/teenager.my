import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl border text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "border-brand bg-brand text-[#faf9f5] shadow-[0_0_0_1px_var(--brand)] hover:bg-[#b85a3a] hover:shadow-[0_0_0_1px_#b85a3a]",
        secondary:
          "border-transparent bg-surface-muted text-foreground shadow-[0_0_0_1px_var(--ring)] hover:bg-[#dfdccf]",
        outline:
          "border-border-strong bg-surface text-foreground shadow-[0_4px_24px_var(--shadow)] hover:bg-surface-strong",
        ghost: "border-transparent bg-transparent text-text-muted hover:bg-surface hover:text-foreground",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-9 rounded-lg px-3 py-2",
        lg: "min-h-12 px-6 py-3 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
