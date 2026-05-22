import React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center font-sans font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 cursor-pointer text-sm select-none",
          variant === "primary" && [
            "bg-primary text-white hover:bg-[#0066d6] active:translate-x-[1px] active:translate-y-[1px] rounded-sm py-2 px-4 border-none",
          ],
          variant === "secondary" && [
            "bg-transparent border border-border-primary text-foreground hover:bg-surface-muted active:translate-x-[1px] active:translate-y-[1px] rounded-sm py-2 px-4",
          ],
          variant === "ghost" && [
            "bg-transparent border-none text-primary hover:underline p-0 m-0",
          ],
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
