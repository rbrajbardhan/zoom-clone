import { useCallback, useEffect, useRef, useState } from "react";
import { WebSocketMessage } from "@/lib/types";

export type ConnectionStatus = "Connecting" | "Connected" | "Disconnected" | "Reconnecting" | "Error";

export interface UseMeetingSocketReturn {
  status: ConnectionStatus;
  logs: string[];
  sendSignal: (
    signalType: "offer" | "answer" | "ice-candidate",
    data: { sdp: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit }
  ) => void;
  sendIdentity: (displayName: string) => void;
  sendChatMessage: (message: string) => void;
  sendMediaState: (audioEnabled: boolean, videoEnabled: boolean, screenSharing: boolean) => void;
  endMeeting: () => void;
}

export default function useMeetingSocket(
  meetingId: string,
  displayName: string | null,
  onMessageReceived?: (message: WebSocketMessage) => void
): UseMeetingSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>("Connecting");
  const [logs, setLogs] = useState<string[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  
  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isIntentionalCloseRef = useRef<boolean>(false);

  // Prevent websocket listener teardowns on callback updates
  const messageCallbackRef = useRef(onMessageReceived);
  useEffect(() => {
    messageCallbackRef.current = onMessageReceived;
  }, [onMessageReceived]);

  useEffect(() => {
    if (!meetingId || !displayName) return;

    isIntentionalCloseRef.current = false;
    reconnectAttemptRef.current = 0;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";
    let wsBaseUrl = apiBaseUrl.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
    
    wsBaseUrl = wsBaseUrl.replace(/\/api\/?$/, "");
    
    const wsUrl = `${wsBaseUrl}/ws/meetings/${meetingId}/`;

    const cleanUpSocket = () => {
      const currentSocket = socketRef.current;
      if (currentSocket) {
        currentSocket.onopen = null;
        currentSocket.onmessage = null;
        currentSocket.onerror = null;
        currentSocket.onclose = null;
        if (currentSocket.readyState === WebSocket.CONNECTING || currentSocket.readyState === WebSocket.OPEN) {
          currentSocket.close();
        }
        socketRef.current = null;
      }
    };

    const attemptConnect = () => {
      cleanUpSocket();

      if (reconnectAttemptRef.current > 0) {
        setStatus("Reconnecting");
        setLogs((prev) => [...prev, `Attempting to reconnect (attempt ${reconnectAttemptRef.current}/5)...`]);
      } else {
        setStatus("Connecting");
        setLogs((prev) => [...prev, "Connecting to signaling server..."]);
      }

      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setStatus("Connected");
        setLogs((prev) => [...prev, "Connected to meeting room signaling server."]);
      };

      socket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          if (message.type === "meeting_ended") {
            isIntentionalCloseRef.current = true;
          }

          if (message.type === "participant_joined") {
            setLogs((prev) => [...prev, `Participant joined: ${message.display_name} (Host: ${message.is_host})`]);
          } else if (message.type === "participant_left") {
            setLogs((prev) => [...prev, `Participant left: ${message.display_name}`]);
          } else if (message.type === "signal") {
            setLogs((prev) => [
              ...prev,
              `Received signal [${message.signal_type}]: ${JSON.stringify(message.data)}`,
            ]);
          } else if (message.type === "chat_message") {
            setLogs((prev) => [...prev, `[Chat] ${message.display_name}: ${message.message}`]);
          } else if (message.type === "chat_error") {
            setLogs((prev) => [...prev, `[Chat Error] ${message.error}`]);
          } else if (message.type === "media_state") {
            setLogs((prev) => [
              ...prev,
              `[Media State] ${message.display_name}: mic=${message.audio_enabled}, cam=${message.video_enabled}, share=${message.screen_sharing}`,
            ]);
          } else if (message.type === "media_state_error") {
            setLogs((prev) => [...prev, `[Media State Error] ${message.error}`]);
          } else if (message.type === "host_changed") {
            setLogs((prev) => [...prev, `[Host Changed] New host: ${message.display_name}`]);
          } else if (message.type === "meeting_ended") {
            setLogs((prev) => [...prev, `[Meeting Ended] Ended by host: ${message.ended_by}`]);
          } else if (message.type === "meeting_error") {
            setLogs((prev) => [...prev, `[Meeting Error] ${message.code}: ${message.message}`]);
          }

          if (messageCallbackRef.current) {
            messageCallbackRef.current(message);
          }
        } catch (err) {
          console.error("Malformed message received", err);
        }
      };

      socket.onerror = () => {
        setStatus("Error");
        setLogs((prev) => [...prev, "Connection error occurred."]);
      };

      socket.onclose = (event) => {
        if (event.code === 4004 || event.code === 4000 || event.code === 4003) {
          isIntentionalCloseRef.current = true;
          setStatus("Error");
          let errorMsg = "Meeting verification failed on the server.";
          if (event.code === 4003) {
            errorMsg = "Invalid display name or ended meeting rejected by the server.";
          }
          setLogs((prev) => [...prev, errorMsg]);
          return;
        }

        if (isIntentionalCloseRef.current) {
          setStatus("Disconnected");
          setLogs((prev) => [...prev, `Connection closed (code: ${event.code}).`]);
          return;
        }

        // Bounded reconnection with exponential backoff
        if (reconnectAttemptRef.current < 5) {
          reconnectAttemptRef.current += 1;
          
          let delay = 1000;
          if (reconnectAttemptRef.current === 2) delay = 2000;
          else if (reconnectAttemptRef.current === 3) delay = 4000;
          else if (reconnectAttemptRef.current === 4) delay = 8000;
          else if (reconnectAttemptRef.current === 5) delay = 10000;

          setStatus("Reconnecting");
          setLogs((prev) => [...prev, `Connection lost. Retrying in ${delay / 1000} seconds...`]);

          reconnectTimerRef.current = setTimeout(() => {
            attemptConnect();
          }, delay);
        } else {
          setStatus("Disconnected");
          setLogs((prev) => [...prev, "Maximum reconnect attempts reached. Disconnected."]);
        }
      };
    };

    attemptConnect();

    return () => {
      isIntentionalCloseRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      cleanUpSocket();
    };
  }, [meetingId, displayName]);

  const sendSignal = useCallback((
    signalType: "offer" | "answer" | "ice-candidate",
    data: { sdp: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit }
  ) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "signal",
          signal_type: signalType,
          data,
        })
      );
      setLogs((prev) => [...prev, `Sent signal [${signalType}]`]);
    } else {
      console.warn("Cannot send signal, WebSocket is not open.");
    }
  }, []);

  const sendIdentity = useCallback((displayName: string) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "identify",
          display_name: displayName,
        })
      );
      setLogs((prev) => [...prev, `Sent identity: ${displayName}`]);
    } else {
      console.warn("Cannot send identity, WebSocket is not open.");
    }
  }, []);

  const sendChatMessage = useCallback((message: string) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "chat_message",
          message,
        })
      );
      setLogs((prev) => [...prev, "Sent chat message"]);
    } else {
      console.warn("Cannot send chat message, WebSocket is not open.");
    }
  }, []);

  const sendMediaState = useCallback((audioEnabled: boolean, videoEnabled: boolean, screenSharing: boolean) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "media_state",
          audio_enabled: audioEnabled,
          video_enabled: videoEnabled,
          screen_sharing: screenSharing,
        })
      );
    } else {
      console.warn("Cannot send media state, WebSocket is not open.");
    }
  }, []);

  const endMeeting = useCallback(() => {
    isIntentionalCloseRef.current = true;
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "end_meeting",
        })
      );
    } else {
      console.warn("Cannot end meeting, WebSocket is not open.");
    }
  }, []);

  return { status, logs, sendSignal, sendIdentity, sendChatMessage, sendMediaState, endMeeting };
}
