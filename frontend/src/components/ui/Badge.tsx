import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "primary" | "secondary" | "danger";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-0.5 text-[10px] font-sans font-bold uppercase tracking-wider select-none leading-none",
        variant === "default" && "bg-surface-muted border-border-secondary text-text-muted",
        variant === "primary" && "bg-primary border-primary text-white",
        variant === "secondary" && "bg-transparent border-border-primary text-foreground",
        variant === "danger" && "bg-red-500/10 border-red-600 text-red-600",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
