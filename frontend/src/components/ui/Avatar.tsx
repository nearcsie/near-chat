import React from "react";
import { cn } from "@/lib/utils";

export interface AvatarProps {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  isOnline?: boolean;
  className?: string;
}

export function Avatar({ name, src, size = "md", isOnline = false, className }: AvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <div className="relative inline-block select-none">
      <div
        className={cn(
          "flex items-center justify-center border border-border-primary bg-surface-muted rounded-sm text-foreground overflow-hidden font-semibold font-sans uppercase",
          sizeClasses[size],
          className
        )}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span>{initials || "U"}</span>
        )}
      </div>

      {/* Online indicator: Small square pip (4x4px or 8x8px) rather than circle */}
      {isOnline && (
        <span
          className={cn(
            "absolute border border-border-primary bg-green-500",
            size === "sm" && "-bottom-0.5 -right-0.5 h-2 w-2",
            size === "md" && "-bottom-0.5 -right-0.5 h-2.5 w-2.5",
            size === "lg" && "bottom-0 right-0 h-3 w-3"
          )}
          style={{ borderRadius: "0px" }} // Flat square indicator pip
        />
      )}
    </div>
  );
}
