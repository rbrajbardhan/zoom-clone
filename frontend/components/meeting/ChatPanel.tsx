import React, { useEffect, useRef, useState } from "react";
import { ChatMessageItem } from "./useMeetingChat";

interface ChatPanelProps {
  messages: ChatMessageItem[];
  isOpen: boolean;
  onClose: () => void;
  onSendMessage: (msg: string) => void;
  error: string | null;
  isConnected: boolean;
  onClearError: () => void;
}

export default function ChatPanel({
  messages,
  isOpen,
  onClose,
  onSendMessage,
  error,
  isConnected,
  onClearError,
}: ChatPanelProps) {
  const [inputText, setInputText] = useState<string>("");
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Automatically scroll chat container to newest message when message list changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || !isConnected) return;
    onSendMessage(trimmed);
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      const trimmed = inputText.trim();
      if (!trimmed || !isConnected) return;
      onSendMessage(trimmed);
      setInputText("");
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <aside
      className="w-full md:w-[320px] bg-[#1b1b1b] border-l border-[#2d2d2d] flex flex-col h-full text-white shadow-xl animate-slide-in relative z-45"
      role="complementary"
      aria-label="Chat Panel"
    >
      {/* Header section */}
      <div className="p-4 border-b border-[#2d2d2d] flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-100">Chat</h2>
          <p className="text-xs text-gray-400 font-semibold">In-meeting messages</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-gray-400 hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b]"
          aria-label="Close panel"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages Scroll Box */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 select-text">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-600 mb-2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
            </svg>
            <p className="text-xs text-gray-500 font-semibold">No messages yet</p>
            <p className="text-[10px] text-gray-600 mt-1">Send a message to everyone in the meeting.</p>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.isLocal ? "items-end" : "items-start"}`}
            >
              {/* Sender & Timestamp */}
              <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-gray-400 font-medium">
                <span className={m.isLocal ? "text-brand font-semibold" : "text-gray-300"}>
                  {m.isLocal ? "You" : m.displayName}
                </span>
                <span>•</span>
                <span>{formatTime(m.timestamp)}</span>
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed break-words whitespace-pre-wrap select-text ${
                  m.isLocal
                    ? "bg-brand text-white rounded-tr-none"
                    : "bg-[#2d2d2d] text-gray-100 rounded-tl-none border border-[#3e3e3e]/40"
                }`}
              >
                {m.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Connection warning status if offline */}
      {!isConnected && (
        <div className="px-4 py-2 bg-red-950/45 border-t border-red-500/20 text-center text-xs text-red-400 font-semibold select-none flex items-center justify-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          Chat unavailable — reconnecting...
        </div>
      )}

      {/* Bottom Form Composer */}
      <form
        onSubmit={handleSubmit}
        className="p-4 border-t border-[#2d2d2d] bg-[#171717]"
      >
        <div className="relative flex flex-col gap-2">
          {/* Character counter / Limits */}
          <div className="flex justify-between items-center text-[9px] text-gray-500 font-semibold select-none">
            <span>Limit 1000 characters</span>
            <span className={inputText.length > 1000 ? "text-red-400" : ""}>
              {inputText.length} / 1000
            </span>
          </div>

          <div className="relative flex items-end bg-[#121212] border border-[#2d2d2d] focus-within:border-brand/60 focus-within:ring-1 focus-within:ring-brand/40 rounded-xl overflow-hidden transition-colors pr-2">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                if (error) onClearError();
              }}
              onKeyDown={handleKeyDown}
              disabled={!isConnected}
              placeholder={isConnected ? "Type a message..." : "Reconnecting..."}
              className="flex-1 w-full bg-transparent border-0 ring-0 outline-none text-sm py-2.5 px-3.5 placeholder-gray-600 resize-none text-white disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Write chat message"
            />
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={!isConnected || !inputText.trim() || inputText.length > 1000}
              className="p-2 mb-1.5 text-gray-400 hover:text-brand disabled:opacity-30 disabled:hover:text-gray-400 transition-colors focus:outline-none"
              aria-label="Send message"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>

          {/* Validation errors */}
          {error && (
            <p className="text-[10px] text-red-400 font-semibold px-1 mt-1 leading-normal select-none">
              {error}
            </p>
          )}
        </div>
      </form>
    </aside>
  );
}
