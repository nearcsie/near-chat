import React, { useEffect, useState } from "react";
import { resolveAssetUrl } from "@/lib/assets";
import { cn } from "@/lib/utils";
import { Avatar } from "./Avatar";
import ProfilePopover from "../chat/ProfilePopover";
import { downloadAttachment } from "@/lib/api";

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
  onReply?: () => void;
  onRecall?: () => void;
  canRecall?: boolean;
  canEdit?: boolean;
}

const renderMentionContent = (
  content: string,
  isOutgoing: boolean,
  isHighEmphasis: boolean,
) => {
  const parts = content.split(/(@[^\s@]+)/g);
  const mentionClass = isOutgoing && isHighEmphasis
    ? "rounded px-1 py-0.5 bg-white/15 text-white font-semibold"
    : "rounded px-1 py-0.5 bg-primary/10 text-primary font-semibold";

  return parts.map((part, index) =>
    part.startsWith("@") ? (
      <span key={`${part}-${index}`} className={mentionClass}>
        {part}
      </span>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    ),
  );
};

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
  onReply,
  onRecall,
  canRecall = false,
  canEdit = false,
}: ChatBubbleProps) {
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [showPopover, setShowPopover] = useState(false);
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({});
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState("");

  useEffect(() => {
    if (!menuPosition) return;
    const close = () => setMenuPosition(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menuPosition]);

  const handleTogglePopover = (event: React.MouseEvent) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const scrollEl = event.currentTarget.closest(".overflow-y-auto");

    if (scrollEl) {
      const parentRect = scrollEl.getBoundingClientRect();
      const relativeTop = rect.top - parentRect.top + rect.height / 2;
      const halfPopover = 170;
      const padding = 12;
      let topVal = relativeTop;

      if (parentRect.height <= halfPopover * 2 + padding * 2) {
        topVal = parentRect.height / 2;
      } else if (topVal - halfPopover < padding) {
        topVal = halfPopover + padding;
      } else if (topVal + halfPopover > parentRect.height - padding) {
        topVal = parentRect.height - halfPopover - padding;
      }

      const offsetTop = topVal - relativeTop;
      setPopoverStyle({
        top: `calc(50% + ${offsetTop}px)`,
        transform: "translateY(-50%)",
      });
    }

    setShowPopover((current) => !current);
  };

  const handleCopy = async () => {
    if (!content || isRecalled) return;
    await navigator.clipboard?.writeText(content);
    setMenuPosition(null);
  };

  const handleDownloadAttachment = async (file: Attachment) => {
    if (!file.url || downloadingUrl) return;

    setDownloadError("");
    setDownloadingUrl(file.url);

    try {
      await downloadAttachment(file.url, file.filename);
    } catch (error) {
      console.error(error);
      setDownloadError(error instanceof Error ? error.message : "Failed to download attachment");
    } finally {
      setDownloadingUrl(null);
    }
  };

  const menuItemClass =
    "w-full px-3 py-2 text-left text-xs hover:bg-surface-muted disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent";

  return (
    <div
      className={cn(
        "flex gap-2 max-w-[85%] font-sans",
        isOutgoing ? "self-end flex-row-reverse" : "self-start flex-row",
      )}
    >
      {!isOutgoing && (
        <div
          className="shrink-0 mt-1 relative cursor-pointer avatar-click-target"
          onClick={handleTogglePopover}
        >
          <Avatar name={senderName} src={senderAvatar} size="sm" />
          {showPopover && (
            <ProfilePopover
              username={senderName}
              onClose={(event) => {
                event.stopPropagation();
                setShowPopover(false);
              }}
              position="custom"
              className="absolute left-full ml-3"
              style={popoverStyle}
            />
          )}
        </div>
      )}

      <div className={cn("flex flex-col gap-1", isOutgoing ? "items-end" : "items-start")}>
        {!isOutgoing && (
          <span
            onClick={handleTogglePopover}
            className="text-xs font-semibold text-text-muted select-none cursor-pointer hover:underline avatar-click-target"
          >
            {senderName}
          </span>
        )}

        <div className="flex items-end gap-1.5">
          {isOutgoing && (
            <div className="flex flex-col items-end text-[10px] text-text-muted font-mono leading-none select-none mb-0.5">
              {roomType === "msg" && isRead && (
                <span className="text-primary font-bold text-[9px] mb-1 font-sans">已讀</span>
              )}
              <span>{timestamp}</span>
            </div>
          )}

          <div
            onContextMenu={(event) => {
              event.preventDefault();
              if (!isRecalled) {
                setMenuPosition({ x: event.clientX, y: event.clientY });
              }
            }}
            className={cn(
              "border rounded-sm p-3 relative flex flex-col gap-2 max-w-md md:max-w-lg",
              isOutgoing
                ? isHighEmphasis
                  ? "bg-primary border-primary text-white"
                  : "bg-surface-muted border-border-primary text-foreground"
                : "bg-surface-card border-border-primary text-foreground",
            )}
          >
            {replyTo && (
              <div
                className={cn(
                  "border-l-2 pl-2 text-xs mb-1 select-none",
                  isOutgoing && isHighEmphasis
                    ? "border-white/50 text-white/80"
                    : "border-primary text-text-muted",
                )}
              >
                <span className="font-bold block">{replyTo.senderName}</span>
                <span className="line-clamp-1">{replyTo.content}</span>
              </div>
            )}

            <div
              className={cn(
                "text-sm break-words whitespace-pre-wrap",
                isRecalled && "italic text-text-muted/70",
              )}
            >
              {isRecalled ? "訊息已收回" : renderMentionContent(content, isOutgoing, isHighEmphasis)}
            </div>

            {attachments.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-1 border-t border-border-secondary/40 pt-2">
                {attachments.map((file, idx) => {
                  const fileContent = (
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
                            isOutgoing && isHighEmphasis ? "text-white/60" : "text-text-muted",
                          )}
                        >
                          {file.filetype}
                        </p>
                      </div>
                    </>
                  );

                  const className = cn(
                    "flex w-full items-center gap-2.5 p-2 border rounded-sm text-xs cursor-pointer select-none transition-colors",
                    isOutgoing && isHighEmphasis
                      ? "bg-white/10 border-white/20 hover:bg-white/20 text-white"
                      : "bg-surface-card border-border-secondary hover:border-border-primary text-foreground",
                  );

                  return file.url ? (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void handleDownloadAttachment(file)}
                      disabled={downloadingUrl === file.url}
                      className={cn(
                        className,
                        "text-left disabled:cursor-wait disabled:opacity-70",
                      )}
                      title={downloadingUrl === file.url ? "Downloading attachment" : "Download attachment"}
                    >
                      {fileContent}
                    </button>
                  ) : (
                    <div key={idx} className={className}>
                      {fileContent}
                    </div>
                  );
                })}
                {downloadError && (
                  <p className="text-[10px] text-danger select-none">
                    {downloadError}
                  </p>
                )}
              </div>
            )}
          </div>

          {menuPosition && (
            <div
              className="fixed z-50 min-w-32 border border-border-primary bg-surface-card text-foreground shadow-lg rounded-sm overflow-hidden"
              style={{ left: menuPosition.x, top: menuPosition.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className={menuItemClass}
                onClick={() => {
                  onReply?.();
                  setMenuPosition(null);
                }}
              >
                回覆訊息
              </button>
              <button
                type="button"
                className={menuItemClass}
                disabled={!canEdit}
                title={canEdit ? undefined : "目前尚未支援修改訊息"}
              >
                修改訊息
              </button>
              <button
                type="button"
                className={menuItemClass}
                disabled={!canRecall}
                onClick={() => {
                  onRecall?.();
                  setMenuPosition(null);
                }}
              >
                收回訊息
              </button>
              <button type="button" className={menuItemClass} onClick={handleCopy}>
                複製文字
              </button>
            </div>
          )}

          {!isOutgoing && (
            <span className="text-[10px] text-text-muted font-mono leading-none select-none mb-0.5">
              {timestamp}
            </span>
          )}
        </div>

        {roomType === "group" && readByAvatars && readByAvatars.length > 0 && (
          <div className="flex gap-1 mt-1 justify-end w-full px-0.5">
            {readByAvatars.map((avatarUrl, idx) => (
              <div
                key={idx}
                className="h-4.5 w-4.5 border border-border-primary bg-surface-muted rounded-sm overflow-hidden select-none"
                title="已讀"
              >
                {avatarUrl ? (
                  <img src={resolveAssetUrl(avatarUrl)} alt="read status" className="h-full w-full object-cover" />
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
