import React, { useRef, useEffect, useImperativeHandle } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, onChange, value, rows = 1, ...props }, ref) => {
    const localRef = useRef<HTMLTextAreaElement | null>(null);

    // Expose the internal textarea ref to the parent
    useImperativeHandle(ref, () => localRef.current!);

    const adjustHeight = () => {
      const textarea = localRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        // Set the height matching the content's scroll height
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    };

    // Auto adjust height when the value initializes or updates
    useEffect(() => {
      adjustHeight();
    }, [value]);

    const handleTextareaChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      adjustHeight();
      if (onChange) {
        onChange(event);
      }
    };

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label className="text-xs font-bold uppercase tracking-wider text-text-muted font-sans select-none">
            {label}
          </label>
        )}
        <textarea
          ref={localRef}
          rows={rows}
          value={value}
          onChange={handleTextareaChange}
          className={cn(
            "w-full bg-surface-card border border-border-secondary hover:border-border-primary focus:border-primary focus:outline-none rounded-sm px-3 py-2 text-sm text-foreground transition-colors placeholder:text-text-muted/60 disabled:opacity-50 disabled:cursor-not-allowed resize-none overflow-hidden min-h-[40px] leading-relaxed",
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

Textarea.displayName = "Textarea";

export { Textarea };
