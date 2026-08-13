"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MeetingHeader from "@/components/meeting/MeetingHeader";
import VideoStage from "@/components/meeting/VideoStage";
import MeetingControls from "@/components/meeting/MeetingControls";
import ParticipantsPanel, { MeetingParticipant } from "@/components/meeting/ParticipantsPanel";
import ChatPanel from "@/components/meeting/ChatPanel";
import PreJoinPreview from "@/components/meeting/PreJoinPreview";
import useMeetingSocket from "@/components/meeting/useMeetingSocket";
import useLocalMedia from "@/components/meeting/useLocalMedia";
import useWebRTC from "@/components/meeting/useWebRTC";
import useScreenShare from "@/components/meeting/useScreenShare";
import useMeetingChat from "@/components/meeting/useMeetingChat";
import useMeetingRecording from "@/components/meeting/useMeetingRecording";
import { getMeeting, joinMeeting } from "@/lib/api";
import { WebSocketMessage, ApiError, type Meeting } from "@/lib/types";

interface PageProps {
  params: Promise<{ meetingId: string }>;
}

export default function MeetingRoomPage({ params }: PageProps) {
  const { meetingId } = React.use(params);
  const router = useRouter();

  // 1. Lifecycle & Verification states
  const [isVerifying, setIsVerifying] = useState<boolean>(true);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [meetingInfo, setMeetingInfo] = useState<Meeting | null>(null);
  
  // Transition flag: user has clicked Join Meeting and REST join completed successfully
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  
  const [isMeetingEnded, setIsMeetingEnded] = useState<boolean>(false);
  const [endedByHost, setEndedByHost] = useState<string | null>(null);
  const [isLocalHost, setIsLocalHost] = useState<boolean>(false);
  const [showEndConfirmation, setShowEndConfirmation] = useState<boolean>(false);

  // Pre-join camera/mic toggle states
  const [mediaEnabled, setMediaEnabled] = useState<boolean>(true);

  // 2. Resolve local participant's display name from sessionStorage (SSR safe)
  const [localDisplayName, setLocalDisplayName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem(`meeting-display-name:${meetingId}`);
    }
    return null;
  });

  const [editName, setEditName] = useState<string>(localDisplayName || "");
  const [nameError, setNameError] = useState<string | null>(null);

  // 3. Generate a temporary session ID for the local participant on mount
  const [localSessionId] = useState<string>(() => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2, 15);
  });

  // 4. Track active meeting participants
  const [remoteParticipant, setRemoteParticipant] = useState<MeetingParticipant | null>(null);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState<boolean>(false);

  // 5. Initialize in-meeting chat state management (deferred access via isJoined check in layout)
  const {
    messages,
    unreadCount,
    isChatOpen,
    error: chatError,
    setIsChatOpen,
    sendMessage,
    receiveMessage,
    receiveErrorMessage,
    setError: setChatError,
  } = useMeetingChat();

  // 6. Initialize meeting local recording state management
  const {
    isRecording,
    isStarting: isRecordingStarting,
    recordingDuration,
    recordingError,
    recordingBlob,
    recordingSize,
    startRecording,
    stopRecording,
    downloadRecording,
    discardRecording,
  } = useMeetingRecording();

  // Ref to hold the active message handler callback to solve lexical ordering and linter issues
  const onMessageReceivedRef = useRef<((message: WebSocketMessage) => void) | null>(null);

  // Verify meeting joinability on mount using getMeeting API client
  useEffect(() => {
    let active = true;
    const checkMeeting = async () => {
      try {
        const data = await getMeeting(meetingId);
        if (active) {
          setMeetingInfo(data);
          if (data.status === "completed") {
            setMeetingError("Meeting has ended.");
          } else if (data.status === "cancelled") {
            setMeetingError("Meeting is unavailable.");
          }
        }
      } catch (err: unknown) {
        if (active) {
          const apiErr = err as ApiError;
          if (apiErr.status === 404) {
            setMeetingError("Meeting not found.");
          } else {
            setMeetingError(apiErr.detail || "Unable to connect to the server.");
          }
        }
      } finally {
        if (active) setIsVerifying(false);
      }
    };
    checkMeeting();
    return () => {
      active = false;
    };
  }, [meetingId]);

  // Message dispatcher to route WebSocket events into useWebRTC hook and chat hooks
  const webRTCMessageReceivedRef = useRef<((message: WebSocketMessage) => void) | null>(null);

  // 10. Initialize WebSocket signaling hook (deferred until display name is resolved, room verified, and user joined)
  const socketDisplayName = (isVerifying || meetingError || !isJoined) ? null : localDisplayName;
  const { status: socketStatus, logs: socketLogs, sendSignal, sendIdentity, sendChatMessage, sendMediaState, endMeeting } = useMeetingSocket(
    meetingId,
    socketDisplayName,
    (msg) => {
      onMessageReceivedRef.current?.(msg);
    }
  );

  // 11. Initialize camera/microphone hardware capture (deferred until validated and mediaEnabled)
  const localMediaEnabled = !isVerifying && !meetingError && mediaEnabled;
  const {
    stream: localStream,
    isLoading: isLocalMediaLoading,
    error: localMediaError,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    stopMedia,
  } = useLocalMedia(localMediaEnabled);

  // 12. Initialize WebRTC peer-to-peer connection hook (deferred until joined)
  const {
    remoteStream,
    connectionState: rtcStatus,
    error: rtcError,
    replaceVideoTrack,
  } = useWebRTC(
    meetingId,
    localStream,
    isJoined && socketStatus === "Connected",
    sendSignal,
    webRTCMessageReceivedRef
  );

  // 13. Initialize Screen Sharing hook
  const {
    isScreenSharing,
    isStarting: isScreenStarting,
    screenStream,
    error: screenError,
    startScreenShare,
    stopScreenShare,
  } = useScreenShare(localStream, replaceVideoTrack);

  // Callback to receive WebSocket events declared after media hooks so it can lexically reference stopMedia and screenStream
  const handleWebSocketMessage = (msg: WebSocketMessage) => {
    // Intercept identity-related events to update local participant lists
    if (msg.type === "participant_joined") {
      if (msg.display_name === localDisplayName) {
        if (msg.is_host) {
          setIsLocalHost(true);
        }
      } else {
        console.log(`Adding remote participant: ${msg.display_name}`);
        setRemoteParticipant({
          id: "remote-session-peer",
          displayName: msg.display_name,
          isLocal: false,
          isAudioEnabled: true,
          isVideoEnabled: true,
          isScreenSharing: false,
          isHost: msg.is_host,
        });
      }

      // Sync local host state if server specifies a host display name
      if (msg.host_display_name) {
        if (msg.host_display_name === localDisplayName) {
          setIsLocalHost(true);
        } else {
          setIsLocalHost(false);
          setRemoteParticipant((prev) => {
            if (prev && prev.displayName === msg.host_display_name) {
              return { ...prev, isHost: true };
            }
            return prev;
          });
        }
      }
    } else if (msg.type === "participant_left") {
      if (msg.display_name !== localDisplayName) {
        console.log(`Removing remote participant: ${msg.display_name}`);
        setRemoteParticipant(null);
      }
    } else if (msg.type === "chat_message") {
      receiveMessage(msg, localDisplayName);
    } else if (msg.type === "chat_error") {
      receiveErrorMessage(msg);
    } else if (msg.type === "media_state") {
      if (msg.display_name !== localDisplayName) {
        setRemoteParticipant((prev) => {
          if (!prev) {
            return {
              id: "remote-session-peer",
              displayName: msg.display_name ?? "Remote Participant",
              isLocal: false,
              isAudioEnabled: msg.audio_enabled,
              isVideoEnabled: msg.video_enabled,
              isScreenSharing: msg.screen_sharing,
            };
          }
          return {
            ...prev,
            isAudioEnabled: msg.audio_enabled,
            isVideoEnabled: msg.video_enabled,
            isScreenSharing: msg.screen_sharing,
          };
        });
      }
    } else if (msg.type === "host_changed") {
      if (msg.display_name === localDisplayName) {
        setIsLocalHost(true);
        setRemoteParticipant((prev) => prev ? { ...prev, isHost: false } : null);
      } else {
        setIsLocalHost(false);
        setRemoteParticipant((prev) => prev ? { ...prev, isHost: prev.displayName === msg.display_name } : null);
      }
    } else if (msg.type === "meeting_ended") {
      console.log("Meeting ended by host.");
      setEndedByHost(msg.ended_by);
      setIsMeetingEnded(true);
      
      // Stop recording capture handle if running
      stopRecording();
      // Release capture hardware
      stopMedia();
      // Release screen share hardware if active
      if (screenStream) {
        screenStream.getTracks().forEach((track) => track.stop());
      }
    } else if (msg.type === "meeting_error") {
      console.error(`Meeting error: ${msg.message}`);
    }

    // Forward signaling payload directly to WebRTC handler
    if (webRTCMessageReceivedRef.current) {
      webRTCMessageReceivedRef.current(msg);
    }
  };

  // Assign dynamic callback on each render in an effect
  useEffect(() => {
    onMessageReceivedRef.current = handleWebSocketMessage;
  });

  // Combine socket signaling logs, screen errors, and recording alerts dynamically for display
  const logs = [...socketLogs];
  if (screenError) {
    logs.push(`Screen Share: ${screenError}`);
  }
  if (recordingError) {
    logs.push(`Recording Error: ${recordingError}`);
  }

  // Trigger WebSocket identity registration handshake on connection open
  useEffect(() => {
    if (socketStatus === "Connected" && localDisplayName) {
      console.log("WebSocket connection established. Sending identity...");
      sendIdentity(localDisplayName);
    }
  }, [socketStatus, localDisplayName, sendIdentity]);

  // Synchronize local microphone, camera, and screen sharing states with peers
  useEffect(() => {
    if (socketStatus === "Connected" && localDisplayName) {
      sendMediaState(isAudioEnabled, isVideoEnabled, isScreenSharing);
    }
  }, [isAudioEnabled, isVideoEnabled, isScreenSharing, socketStatus, localDisplayName, sendMediaState]);

  // Validation function for display name editing
  const validateName = (val: string): boolean => {
    const trimmed = val.trim();
    if (!trimmed) {
      setNameError("Display name is required.");
      return false;
    }
    if (trimmed.length < 2) {
      setNameError("Display name must contain at least 2 characters.");
      return false;
    }
    if (trimmed.length > 100) {
      setNameError("Display name cannot exceed 100 characters.");
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateName(editName)) return;

    const name = editName.trim();
    setIsSubmitting(true);
    setJoinError(null);

    try {
      // Validate join session with the server and create Participant record
      await joinMeeting(meetingId, { display_name: name });
      
      // Success: Save temporary name to sessionStorage
      sessionStorage.setItem(`meeting-display-name:${meetingId}`, name);
      setLocalDisplayName(name);
      setIsJoined(true);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setJoinError(apiErr.detail || "Unable to join the meeting room. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinWithoutMedia = async () => {
    // Disable media capture first to release tracks
    setMediaEnabled(false);
    stopMedia();

    if (!validateName(editName)) return;

    const name = editName.trim();
    setIsSubmitting(true);
    setJoinError(null);

    try {
      await joinMeeting(meetingId, { display_name: name });
      sessionStorage.setItem(`meeting-display-name:${meetingId}`, name);
      setLocalDisplayName(name);
      setIsJoined(true);
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setJoinError(apiErr.detail || "Unable to join the meeting room. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeave = () => {
    // Stop recording capture handle if running
    stopRecording();
    // Release capture hardware
    stopMedia();
    // Release screen share hardware if active
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }
    // Redirect back to dashboard
    router.push("/");
  };

  // Escape key handler to close drawers/panels
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsChatOpen(false);
        setIsParticipantsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsChatOpen, setIsParticipantsOpen]);

  const handleEndMeeting = () => {
    setShowEndConfirmation(true);
  };

  // Mutually exclusive sidebar drawers: opening Chat closes Participants and vice-versa
  const handleToggleParticipants = () => {
    const next = !isParticipantsOpen;
    setIsParticipantsOpen(next);
    if (next) {
      setIsChatOpen(false);
    }
  };

  const handleToggleChat = () => {
    const next = !isChatOpen;
    setIsChatOpen(next);
    if (next) {
      setIsParticipantsOpen(false);
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording(localStream, screenStream);
    }
  };

  const handleSendChatMessage = (msg: string) => {
    sendMessage(msg, sendChatMessage);
  };

  // Render verifying loaders
  if (isVerifying) {
    return (
      <main className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-6 text-center select-none text-white">
        <div className="space-y-4">
          <svg className="w-8 h-8 animate-spin text-brand mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Verifying meeting room...</p>
        </div>
      </main>
    );
  }

  // Render ended or cancelled splash screens
  if (meetingError || isMeetingEnded) {
    let errorTitle = "Meeting Room";
    let errorMessage = meetingError;

    if (isMeetingEnded) {
      errorTitle = "Meeting Ended";
      errorMessage = endedByHost 
        ? `The host (${endedByHost}) has ended this meeting for everyone.`
        : "The host has ended this meeting.";
    } else if (meetingError === "Meeting has ended.") {
      errorTitle = "Meeting Ended";
      errorMessage = "This meeting has already ended.";
    } else if (meetingError === "Meeting is unavailable.") {
      errorTitle = "Meeting Cancelled";
      errorMessage = "This meeting is unavailable.";
    } else if (meetingError === "Meeting not found.") {
      errorTitle = "Meeting Not Found";
      errorMessage = "This meeting room does not exist.";
    }

    return (
      <main className="min-h-screen bg-[#121212] flex flex-col items-center justify-center p-6 text-center select-none text-white">
        <div className="w-full max-w-md bg-[#1b1b1b] border border-[#2d2d2d] rounded-2xl p-8 shadow-xl space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{errorTitle}</h1>
            <p className="text-sm text-gray-400 font-semibold">{errorMessage}</p>
          </div>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full py-3 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-white rounded-xl text-sm font-bold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-[#1b1b1b]"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  // Render Pre-Join / Waiting Room UI if isJoined is false
  if (!isJoined) {
    const formattedDuration = meetingInfo
      ? `${meetingInfo.duration_minutes} minutes`
      : "60 minutes";

    const formattedTime = meetingInfo && meetingInfo.scheduled_at
      ? new Date(meetingInfo.scheduled_at).toLocaleString([], {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : null;

    const isJoinDisabled = isSubmitting || isLocalMediaLoading || !!nameError || !editName.trim();

    return (
      <main className="min-h-screen bg-[#121212] flex flex-col justify-between text-white select-none">
        {/* Pre-Join Header */}
        <header className="w-full bg-[#1b1b1b] border-b border-[#2d2d2d] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6 text-brand"
              aria-hidden="true"
            >
              <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.94-.94 2.56-.27 2.56 1.06v11.38c0 1.33-1.62 2-2.56 1.06Z" />
            </svg>
            <span className="font-bold tracking-tight text-sm sm:text-base">
              Zoom Clone
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-xs text-gray-400">
            <span className="text-gray-500 uppercase font-sans font-bold text-[10px] tracking-wider">ID:</span>
            <span className="font-semibold select-all text-gray-200">{meetingId}</span>
          </div>
        </header>

        {/* Pre-Join Body Layout */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[#1b1b1b] border border-[#2d2d2d] rounded-2xl p-6 sm:p-8 shadow-2xl relative">
            
            {/* Left Column: Media Preview */}
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-400">Camera Preview</h2>
              
              <PreJoinPreview
                stream={localStream}
                isLoading={isLocalMediaLoading}
                error={localMediaError}
                isVideoEnabled={isVideoEnabled}
              />

              {/* Preview controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={toggleAudio}
                  disabled={isLocalMediaLoading || !!localMediaError}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 focus:outline-none ${
                    isAudioEnabled && !localMediaError
                      ? "bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200"
                      : "bg-red-950/45 border border-red-500/25 text-red-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                  Microphone: {isAudioEnabled && !localMediaError ? "On" : "Muted"}
                </button>
                <button
                  type="button"
                  onClick={toggleVideo}
                  disabled={isLocalMediaLoading || !!localMediaError}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 focus:outline-none ${
                    isVideoEnabled && !localMediaError
                      ? "bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-200"
                      : "bg-red-950/45 border border-red-500/25 text-red-400"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
                  Camera: {isVideoEnabled && !localMediaError ? "On" : "Off"}
                </button>
              </div>
            </div>

            {/* Right Column: Information & Forms */}
            <div className="space-y-6">
              {/* Meeting Info */}
              <div className="space-y-2">
                <span className="inline-block text-[9px] bg-brand/10 border border-brand/20 text-brand px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                  {meetingInfo?.meeting_type === "instant" ? "Instant Meeting" : "Scheduled Meeting"}
                </span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-100">
                  {meetingInfo?.title || "Instant Meeting"}
                </h1>
                <div className="space-y-1 font-semibold text-xs text-gray-400">
                  <p>Duration: <span className="text-gray-200">{formattedDuration}</span></p>
                  {formattedTime && (
                    <p>Scheduled: <span className="text-gray-200">{formattedTime}</span></p>
                  )}
                </div>
              </div>

              {/* Display Name Input */}
              <form onSubmit={handleJoin} className="space-y-4">
                <div>
                  <label htmlFor="preJoinNameInput" className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
                    Your Display Name
                  </label>
                  <input
                    id="preJoinNameInput"
                    type="text"
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value);
                      validateName(e.target.value);
                    }}
                    placeholder="Enter display name"
                    autoFocus
                    className={`w-full px-3.5 py-2.5 bg-[#121212] border rounded-xl shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-colors text-white ${
                      nameError ? "border-red-500 focus:ring-red-500" : "border-[#2d2d2d]"
                    }`}
                  />
                  {nameError && (
                    <p className="mt-2 text-xs text-red-400 font-semibold">{nameError}</p>
                  )}
                </div>

                {joinError && (
                  <div className="p-3 bg-red-950/45 border border-red-500/25 text-red-400 rounded-xl text-xs font-semibold leading-relaxed">
                    {joinError}
                  </div>
                )}

                {/* Primary/Secondary Buttons */}
                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={isJoinDisabled}
                    className="w-full py-3 bg-brand hover:bg-brand/90 disabled:bg-[#2d2d2d] disabled:text-gray-500 text-white rounded-xl text-sm font-bold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b] flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Joining Meeting...
                      </>
                    ) : (
                      "Join Meeting"
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleJoinWithoutMedia}
                    disabled={isSubmitting || !!nameError || !editName.trim()}
                    className="w-full py-2.5 bg-[#252525] hover:bg-[#2f2f2f] text-gray-300 rounded-xl text-xs font-bold transition-colors focus:outline-none"
                  >
                    Continue without media
                  </button>

                  <button
                    type="button"
                    onClick={handleLeave}
                    className="w-full py-2.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-400 rounded-xl text-xs font-bold transition-colors focus:outline-none"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Symmetrical footer */}
        <footer className="w-full py-4 text-center text-[10px] text-gray-500 font-medium">
          © 2026 Zoom Clone. All rights reserved.
        </footer>
      </main>
    );
  }

  // Build the reactive participant list once joined
  const localParticipant: MeetingParticipant = {
    id: localSessionId,
    displayName: localDisplayName || "You",
    isLocal: true,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    isHost: isLocalHost,
  };

  const allParticipants = remoteParticipant
    ? [localParticipant, remoteParticipant]
    : [localParticipant];

  // Render meeting room stage view once user explicitly joins
  return (
    <div className="min-h-screen max-h-screen bg-[#121212] flex flex-col justify-between overflow-hidden relative select-none">
      {/* Top Header Section */}
      <MeetingHeader
        meetingId={meetingId}
        connectionStatus={socketStatus}
        rtcStatus={rtcStatus}
        isRecording={isRecording}
        recordingDuration={recordingDuration}
        isHost={isLocalHost}
      />

      {/* Main content split between video grid and participant sidebar */}
      <div className="flex-1 flex overflow-hidden relative">
        <VideoStage
          meetingId={meetingId}
          connectionStatus={socketStatus}
          logs={logs}
          stream={localStream}
          isLoading={isLocalMediaLoading}
          error={localMediaError || rtcError}
          isVideoEnabled={isVideoEnabled}
          remoteStream={remoteStream}
          rtcStatus={rtcStatus}
          localDisplayName={localDisplayName || "You"}
          remoteDisplayName={remoteParticipant?.displayName ?? null}
          isScreenSharing={isScreenSharing}
          screenStream={screenStream}
        />

        <ParticipantsPanel
          participants={allParticipants}
          isOpen={isParticipantsOpen}
          onClose={() => setIsParticipantsOpen(false)}
          localAudioEnabled={isAudioEnabled}
          localVideoEnabled={isVideoEnabled}
        />

        <ChatPanel
          messages={messages}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          onSendMessage={handleSendChatMessage}
          error={chatError}
          isConnected={socketStatus === "Connected"}
          onClearError={() => setChatError(null)}
        />
      </div>

      {/* Bottom control bar toolbar */}
      <MeetingControls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        isParticipantsOpen={isParticipantsOpen}
        isScreenSharing={isScreenSharing}
        isScreenStarting={isScreenStarting}
        isChatOpen={isChatOpen}
        unreadCount={unreadCount}
        isRecording={isRecording}
        isRecordingStarting={isRecordingStarting}
        isHost={isLocalHost}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleParticipants={handleToggleParticipants}
        onToggleScreenShare={isScreenSharing ? stopScreenShare : startScreenShare}
        onToggleChat={handleToggleChat}
        onToggleRecording={handleToggleRecording}
        onEndMeeting={handleEndMeeting}
        onLeave={handleLeave}
      />

      {/* Local Recording completed panel overlay */}
      {recordingBlob && !isRecording && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1b1b1b] border border-[#2d2d2d] rounded-2xl p-6 sm:p-8 w-full max-w-sm text-center shadow-2xl space-y-5 animate-fade-in text-white select-none">
            <div className="mx-auto w-12 h-12 rounded-full bg-brand/10 border border-brand/20 flex items-center justify-center text-brand">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-100">Recording Ready</h3>
              <p className="text-xs text-gray-400">Your meeting recording has been completed and is stored in browser memory.</p>
            </div>
            <div className="bg-[#121212] border border-[#2d2d2d] rounded-xl p-3.5 flex items-center justify-around font-mono text-xs text-gray-300">
              <div className="text-center">
                <span className="block text-[8px] text-gray-500 uppercase font-sans font-bold tracking-wider mb-1">Duration</span>
                <span className="font-semibold text-gray-200">{formatDuration(recordingDuration)}</span>
              </div>
              <div className="h-6 w-px bg-[#2d2d2d]" />
              <div className="text-center">
                <span className="block text-[8px] text-gray-500 uppercase font-sans font-bold tracking-wider mb-1">File Size</span>
                <span className="font-semibold text-gray-200">{(recordingSize / (1024 * 1024)).toFixed(2)} MB</span>
              </div>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => downloadRecording(meetingId)}
                className="w-full py-2.5 bg-brand hover:bg-brand/90 text-white rounded-xl text-xs font-bold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b]"
              >
                Download Recording
              </button>
              <button
                type="button"
                onClick={discardRecording}
                className="w-full py-2.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-300 rounded-xl text-xs font-bold transition-colors focus:outline-none"
              >
                Discard
              </button>
            </div>
            <p className="text-[9px] text-gray-500 leading-normal">
              * This recording is stored locally in your browser memory and is never uploaded to the server. Closing or reloading this tab before downloading will discard it.
            </p>
          </div>
        </div>
      )}

      {/* Reconnecting overlay */}
      {socketStatus === "Reconnecting" && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-40 select-none pointer-events-none">
          <div className="bg-[#1b1b1b]/95 border border-orange-500/30 rounded-2xl p-6 w-full max-w-sm text-center shadow-2xl space-y-4 animate-fade-in text-white pointer-events-auto">
            <div className="mx-auto w-12 h-12 rounded-full bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-100">Connection interrupted</h3>
              <p className="text-xs text-orange-400 font-semibold animate-pulse">Trying to reconnect...</p>
              <p className="text-[10px] text-gray-400 pt-1">Your camera and microphone are still active.</p>
            </div>
          </div>
        </div>
      )}

      {/* End Meeting confirmation overlay dialog popup */}
      {showEndConfirmation && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[#1b1b1b] border border-[#2d2d2d] rounded-2xl p-6 sm:p-8 w-full max-w-sm text-center shadow-2xl space-y-5 animate-fade-in text-white select-none">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
              </svg>
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-100">End meeting for everyone?</h3>
              <p className="text-xs text-gray-400">Are you sure you want to end this meeting? This will disconnect all participants.</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setShowEndConfirmation(false);
                  endMeeting();
                }}
                className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#1b1b1b]"
              >
                End Meeting
              </button>
              <button
                type="button"
                onClick={() => setShowEndConfirmation(false)}
                className="w-full py-2.5 bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-300 rounded-xl text-xs font-bold transition-colors focus:outline-none"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const formatDuration = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pad = (val: number) => String(val).padStart(2, "0");
  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
};
