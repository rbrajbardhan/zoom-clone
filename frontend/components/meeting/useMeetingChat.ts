import { useState, useCallback, useRef, useEffect } from "react";
import { ChatMessage, ChatErrorMessage } from "@/lib/types";

export interface ChatMessageItem {
  id: string;
  displayName: string;
  message: string;
  timestamp: string;
  isLocal: boolean;
}

export interface UseMeetingChatReturn {
  messages: ChatMessageItem[];
  unreadCount: number;
  isChatOpen: boolean;
  error: string | null;
  setIsChatOpen: (open: boolean) => void;
  sendMessage: (message: string, socketSend: (msg: string) => void) => void;
  receiveMessage: (msg: ChatMessage, localDisplayName: string | null) => void;
  receiveErrorMessage: (msg: ChatErrorMessage) => void;
  clearUnread: () => void;
  setError: (err: string | null) => void;
}

export default function useMeetingChat(): UseMeetingChatReturn {
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const isChatOpenRef = useRef<boolean>(isChatOpen);

  useEffect(() => {
    isChatOpenRef.current = isChatOpen;
    if (isChatOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUnreadCount(0);
      setError(null);
    }
  }, [isChatOpen]);

  const sendMessage = useCallback((message: string, socketSend: (msg: string) => void) => {
    setError(null);
    const trimmed = message.trim();
    if (!trimmed) {
      setError("Message cannot be empty.");
      return;
    }
    if (trimmed.length > 1000) {
      setError("Message is too long.");
      return;
    }

    socketSend(trimmed);
  }, []);

  const receiveMessage = useCallback((msg: ChatMessage, localDisplayName: string | null) => {
    const isLocal = msg.display_name === localDisplayName;
    const msgId = `${msg.display_name}-${msg.timestamp}-${msg.message}`;

    setMessages((prev) => {
      // Prevent duplicate message renders
      if (prev.some((m) => m.id === msgId)) {
        return prev;
      }
      const newMsg: ChatMessageItem = {
        id: msgId,
        displayName: msg.display_name,
        message: msg.message,
        timestamp: msg.timestamp,
        isLocal,
      };
      return [...prev, newMsg];
    });

    // Only track unread counts for remote messages while chat panel is closed
    if (!isChatOpenRef.current && !isLocal) {
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const receiveErrorMessage = useCallback((msg: ChatErrorMessage) => {
    setError(msg.error);
  }, []);

  const clearUnread = useCallback(() => {
    setUnreadCount(0);
  }, []);

  return {
    messages,
    unreadCount,
    isChatOpen,
    error,
    setIsChatOpen,
    sendMessage,
    receiveMessage,
    receiveErrorMessage,
    clearUnread,
    setError,
  };
}
