import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import ProfilePopover from "../chat/ProfilePopover";

export interface Attachment {
  filename: string;
  filetype: string;
  url?: string;
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
  senderAvatar?: string;
  isRead?: boolean;
  readByAvatars?: string[];
  roomType?: "msg" | "group";
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
  senderAvatar,
  isRead = false,
  readByAvatars = [],
  roomType = "msg",
}: ChatBubbleProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});

  const handleTogglePopover = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const scrollEl = e.currentTarget.closest(".overflow-y-auto");
    if (scrollEl) {
      const parentRect = scrollEl.getBoundingClientRect();
      const relativeTop = rect.top - parentRect.top + rect.height / 2;
      const halfPopover = 170; // Half of estimated popover height (340px)
      const padding = 12;      // Top/bottom margins
      let topVal = relativeTop;

      if (parentRect.height <= (halfPopover * 2 + padding * 2)) {
        topVal = parentRect.height / 2;
      } else {
        if (topVal - halfPopover < padding) {
          topVal = halfPopover + padding;
        } else if (topVal + halfPopover > parentRect.height - padding) {
          topVal = parentRect.height - halfPopover - padding;
        }
      }

      const offsetTop = topVal - relativeTop;
      setPopoverStyle({
        top: `calc(50% + ${offsetTop}px)`,
        transform: "translateY(-50%)",
      });
    }
    setShowPopover(!showPopover);
  };

  return (
    <div
      className={cn(
        "flex gap-2 max-w-[85%] font-sans",
        isOutgoing ? "self-end flex-row-reverse" : "self-start flex-row"
      )}
    >
      {/* Sender Avatar (only for incoming messages) */}
      {!isOutgoing && (
        <div
          className="shrink-0 mt-1 relative cursor-pointer avatar-click-target"
          onClick={handleTogglePopover}
        >
          <Avatar name={senderName} src={senderAvatar} size="sm" />
          {showPopover && (
            <ProfilePopover
              username={senderName}
              onClose={(e) => {
                e.stopPropagation();
                setShowPopover(false);
              }}
              position="custom"
              className="absolute left-full ml-3"
              style={popoverStyle}
            />
          )}
        </div>
      )}

      {/* Message and Metadata Column */}
      <div className={cn("flex flex-col gap-1", isOutgoing ? "items-end" : "items-start")}>
        {/* Sender Name */}
        {!isOutgoing && (
          <span
            onClick={handleTogglePopover}
            className="text-xs font-semibold text-text-muted select-none cursor-pointer hover:underline avatar-click-target"
          >
            {senderName}
          </span>
        )}

        {/* Bubble & Metadata Row */}
        <div className="flex items-end gap-1.5">
          {/* Outgoing Metadata (Timestamp and LINE-style "已讀") */}
          {isOutgoing && (
            <div className="flex flex-col items-end text-[10px] text-text-muted font-mono leading-none select-none mb-0.5">
              {roomType === "msg" && isRead && (
                <span className="text-primary font-bold text-[9px] mb-1 font-sans">已讀</span>
              )}
              <span>{timestamp}</span>
            </div>
          )}

          {/* Bubble Container */}
          <div
            className={cn(
              "border rounded-sm p-3 relative flex flex-col gap-2 max-w-md md:max-w-lg",
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
                {attachments.map((file, idx) => {
                  const content = (
                    <>
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
                    </>
                  );

                  const className = cn(
                    "flex items-center gap-2.5 p-2 border rounded-sm text-xs cursor-pointer select-none transition-colors",
                    isOutgoing && isHighEmphasis
                      ? "bg-white/10 border-white/20 hover:bg-white/20 text-white"
                      : "bg-surface-card border-border-secondary hover:border-border-primary text-foreground"
                  );

                  return file.url ? (
                    <a
                      key={idx}
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className={className}
                    >
                      {content}
                    </a>
                  ) : (
                    <div
                    key={idx}
                      className={className}
                    >
                      {content}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Incoming Metadata (Timestamp) */}
          {!isOutgoing && (
            <span className="text-[10px] text-text-muted font-mono leading-none select-none mb-0.5">
              {timestamp}
            </span>
          )}
        </div>

        {/* Group Read Status (Messenger style) */}
        {roomType === "group" && readByAvatars && readByAvatars.length > 0 && (
          <div className="flex gap-1 mt-1 justify-end w-full px-0.5">
            {readByAvatars.map((avatarUrl, idx) => (
              <div
                key={idx}
                className="h-4.5 w-4.5 border border-border-primary bg-surface-muted rounded-sm overflow-hidden select-none"
                title="已讀"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="read status" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[8px] flex items-center justify-center h-full w-full font-bold">R</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
