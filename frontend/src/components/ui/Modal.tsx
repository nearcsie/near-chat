import React, { useEffect } from "react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay: 50% opacity of the opposite theme (dark overlay in light, light overlay in dark) */}
      <div
        className="fixed inset-0 bg-[#000000]/50 dark:bg-[#ffffff]/50 transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container: Flat, no shadow, strong border */}
      <div
        className={cn(
          "relative z-10 w-full max-w-lg bg-surface-card border border-border-primary rounded-sm overflow-hidden flex flex-col max-h-[85vh]",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-primary px-5 py-4 bg-surface-muted select-none">
          <h2 className="font-sans font-semibold text-sm text-foreground uppercase tracking-wider">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-foreground hover:text-primary transition-colors cursor-pointer p-0.5 border border-transparent hover:border-border-primary rounded-sm"
            aria-label="Close modal"
          >
            <svg
              className="h-4.5 w-4.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 font-sans text-sm text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
