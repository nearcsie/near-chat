import React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", label, error, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-bold uppercase tracking-wider text-text-muted font-sans select-none">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-text-muted/60 disabled:opacity-50 disabled:cursor-not-allowed",
            error && "border-red-600 focus:border-red-600",
            className
          )}
          {...props}
        />
        {error && <span className="text-xs text-red-600 font-sans">{error}</span>}
      </div>
    );
  }
);

Input.displayName = "Input";

export { Input };
