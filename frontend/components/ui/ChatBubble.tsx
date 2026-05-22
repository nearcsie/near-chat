import React from "react";
import { cn } from "@/lib/utils";

export interface Attachment {
  filename: string;
  filetype: string;
}

export interface ChatBubbleProps {
  content: string;
  senderName: string;
  timestamp: string;
  isOutgoing?: boolean;
  isHighEmphasis?: boolean;
  isRecalled?: boolean;
  replyTo?: {
    senderName: string;
    content: string;
  };
  attachments?: Attachment[];
}

export function ChatBubble({
  content,
  senderName,
  timestamp,
  isOutgoing = false,
  isHighEmphasis = false,
  isRecalled = false,
  replyTo,
  attachments = [],
}: ChatBubbleProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 max-w-[70%] font-sans",
        isOutgoing ? "self-end items-end" : "self-start items-start"
      )}
    >
      {/* Sender Name (only for incoming messages) */}
      {!isOutgoing && (
        <span className="text-xs font-semibold text-text-muted select-none">
          {senderName}
        </span>
      )}

      {/* Bubble Container */}
      <div
        className={cn(
          "border rounded-sm p-3 relative flex flex-col gap-2",
          isOutgoing
            ? isHighEmphasis
              ? "bg-primary border-primary text-white"
              : "bg-surface-muted border-border-primary text-foreground"
            : "bg-surface-card border-border-primary text-foreground"
        )}
      >
        {/* Reply Quote Block */}
        {replyTo && (
          <div
            className={cn(
              "border-l-2 pl-2 text-xs mb-1 select-none",
              isOutgoing && isHighEmphasis
                ? "border-white/50 text-white/80"
                : "border-primary text-text-muted"
            )}
          >
            <span className="font-bold block">{replyTo.senderName}</span>
            <span className="line-clamp-1">{replyTo.content}</span>
          </div>
        )}

        {/* Message Content */}
        <div className={cn("text-sm break-words", isRecalled && "italic text-text-muted/70")}>
          {isRecalled ? "該訊息已被收回" : content}
        </div>

        {/* Attachments Section */}
        {attachments.length > 0 && (
          <div className="flex flex-col gap-1.5 mt-1 border-t border-border-secondary/40 pt-2">
            {attachments.map((file, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-2.5 p-2 border rounded-sm text-xs cursor-pointer select-none transition-colors",
                  isOutgoing && isHighEmphasis
                    ? "bg-white/10 border-white/20 hover:bg-white/20 text-white"
                    : "bg-surface-card border-border-secondary hover:border-border-primary text-foreground"
                )}
              >
                {/* File Attachment Icon */}
                <svg
                  className="h-4 w-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate leading-tight">{file.filename}</p>
                  <p
                    className={cn(
                      "text-[9px] uppercase tracking-wider font-mono mt-0.5",
                      isOutgoing && isHighEmphasis ? "text-white/60" : "text-text-muted"
                    )}
                  >
                    {file.filetype}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-text-muted select-none mt-0.5 px-0.5 font-mono">
        {timestamp}
      </span>
    </div>
  );
}
