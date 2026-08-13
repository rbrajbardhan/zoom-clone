interface MeetingControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isParticipantsOpen: boolean;
  isScreenSharing: boolean;
  isScreenStarting: boolean;
  isChatOpen: boolean;
  unreadCount: number;
  isRecording?: boolean;
  isRecordingStarting?: boolean;
  isHost?: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleParticipants: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleRecording?: () => void;
  onEndMeeting?: () => void;
  onLeave: () => void;
}

export default function MeetingControls({
  isAudioEnabled,
  isVideoEnabled,
  isParticipantsOpen,
  isScreenSharing,
  isScreenStarting,
  isChatOpen,
  unreadCount,
  isRecording = false,
  isRecordingStarting = false,
  isHost = false,
  onToggleAudio,
  onToggleVideo,
  onToggleParticipants,
  onToggleScreenShare,
  onToggleChat,
  onToggleRecording,
  onEndMeeting,
  onLeave,
}: MeetingControlsProps) {
  return (
    <footer 
      className="w-full bg-[#1b1b1b] border-t border-[#2d2d2d] py-3 px-6 flex items-center justify-between text-white select-none"
      role="contentinfo"
    >
      {/* Left spacer for layout alignment (symmetrical layout) */}
      <div className="hidden sm:block w-[100px]" aria-hidden="true" />

      {/* Center Group: Media Controls */}
      <div className="flex items-center gap-1 sm:gap-2 mx-auto sm:mx-0 flex-wrap justify-center">
        {/* Mute/Unmute Control */}
        <button
          type="button"
          onClick={onToggleAudio}
          className="group flex flex-col items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b] transition-colors"
          aria-label={isAudioEnabled ? "Mute microphone" : "Unmute microphone"}
          title={isAudioEnabled ? "Mute" : "Unmute"}
        >
          {isAudioEnabled ? (
            // Microphone Enabled Icon
            <div className="text-gray-300 group-hover:text-white transition-colors" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
          ) : (
            // Microphone Disabled/Muted Icon
            <div className="text-red-500 group-hover:text-red-400 transition-colors" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
              </svg>
            </div>
          )}
          <span className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${
            isAudioEnabled ? "text-gray-400 group-hover:text-gray-300" : "text-red-400 group-hover:text-red-300"
          }`}>
            {isAudioEnabled ? "Mute" : "Unmute"}
          </span>
        </button>

        {/* Camera On/Off Control */}
        <button
          type="button"
          onClick={onToggleVideo}
          className="group flex flex-col items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#2d2d2d] focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b] transition-colors"
          aria-label={isVideoEnabled ? "Turn camera off" : "Turn camera on"}
          title={isVideoEnabled ? "Turn Camera Off" : "Turn Camera On"}
        >
          {isVideoEnabled ? (
            // Camera Enabled Icon
            <div className="text-gray-300 group-hover:text-white transition-colors" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
            </div>
          ) : (
            // Camera Disabled Icon
            <div className="text-red-500 group-hover:text-red-400 transition-colors" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.843-3H13.5m-9-3h9A2.25 2.25 0 0 1 15.75 5.25v3M3 3l18 18" />
              </svg>
            </div>
          )}
          <span className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${
            isVideoEnabled ? "text-gray-400 group-hover:text-gray-300" : "text-red-400 group-hover:text-red-300"
          }`}>
            {isVideoEnabled ? "Camera" : "Camera Off"}
          </span>
        </button>

        {/* Share Screen Control */}
        <button
          type="button"
          onClick={onToggleScreenShare}
          disabled={isScreenStarting}
          className={`group flex flex-col items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b] ${
            isScreenSharing
              ? "bg-red-600 hover:bg-red-700 text-white"
              : "hover:bg-[#2d2d2d] text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          }`}
          aria-label={isScreenSharing ? "Stop sharing screen" : "Share screen"}
          title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
        >
          {isScreenStarting ? (
            // Loading Spinner
            <div className="text-white" aria-hidden="true">
              <svg className="w-4.5 h-4.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ) : isScreenSharing ? (
            // Stop Screen Share Icon
            <div className="text-white" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M6 18.75h12a2.25 2.25 0 0 0 2.25-2.25v-9A2.25 2.25 0 0 0 18 5.25H6A2.25 2.25 0 0 0 6 18.75Z" />
              </svg>
            </div>
          ) : (
            // Start Screen Share Icon
            <div className="text-gray-300 group-hover:text-white transition-colors" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25M19.5 3h-15a2.25 2.25 0 0 0-2.25 2.25v9.75A2.25 2.25 0 0 0 4.5 17.25h15a2.25 2.25 0 0 0 2.25-2.25V5.25A2.25 2.25 0 0 0 19.5 3Z" />
              </svg>
            </div>
          )}
          <span className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${
            isScreenSharing ? "text-white" : "text-gray-400 group-hover:text-gray-300"
          }`}>
            {isScreenStarting ? "Starting..." : isScreenSharing ? "Stop Share" : "Share"}
          </span>
        </button>

        {/* Participants Control */}
        <button
          type="button"
          onClick={onToggleParticipants}
          className={`group flex flex-col items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b] ${
            isParticipantsOpen ? "bg-brand text-white hover:bg-brand/90" : "hover:bg-[#2d2d2d] text-gray-300"
          }`}
          aria-label={isParticipantsOpen ? "Hide participants list" : "Show participants list"}
          title={isParticipantsOpen ? "Hide Participants" : "Show Participants"}
        >
          <div
            className={`transition-colors ${
              isParticipantsOpen ? "text-white" : "text-gray-300 group-hover:text-white"
            }`}
            aria-hidden="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.97 5.97 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
            </svg>
          </div>
          <span
            className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${
              isParticipantsOpen ? "text-white" : "text-gray-400 group-hover:text-gray-300"
            }`}
          >
            Participants
          </span>
        </button>

        {/* Chat Control */}
        <button
          type="button"
          onClick={onToggleChat}
          className={`relative group flex flex-col items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b] ${
            isChatOpen ? "bg-brand text-white hover:bg-brand/90" : "hover:bg-[#2d2d2d] text-gray-300"
          }`}
          aria-label={isChatOpen ? "Hide chat panel" : "Show chat panel"}
          title={isChatOpen ? "Hide Chat" : "Show Chat"}
        >
          {unreadCount > 0 && (
            <span className="absolute top-1 right-2.5 bg-red-600 text-white text-[8px] font-bold rounded-full h-3.5 min-w-[14.5px] px-1 flex items-center justify-center select-none shadow-sm z-10">
              {unreadCount}
            </span>
          )}
          <div
            className={`transition-colors ${
              isChatOpen ? "text-white" : "text-gray-300 group-hover:text-white"
            }`}
            aria-hidden="true"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
            </svg>
          </div>
          <span
            className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${
              isChatOpen ? "text-white" : "text-gray-400 group-hover:text-gray-300"
            }`}
          >
            Chat
          </span>
        </button>

        {/* Local Recording Control */}
        {onToggleRecording && (
          <button
            type="button"
            onClick={onToggleRecording}
            disabled={isRecordingStarting}
            className={`group flex flex-col items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 focus:ring-offset-[#1b1b1b] ${
              isRecording
                ? "bg-red-600 text-white hover:bg-red-700 font-bold"
                : "hover:bg-[#2d2d2d] text-gray-300 disabled:opacity-50"
            }`}
            aria-label={isRecording ? "Stop local meeting recording" : "Start local meeting recording"}
            title={isRecording ? "Stop Recording" : "Record"}
          >
            {isRecordingStarting ? (
              // Recording Loading Spinner
              <div className="text-white" aria-hidden="true">
                <svg className="w-4.5 h-4.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            ) : isRecording ? (
              // Stop Recording Icon
              <div className="text-white" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z" />
                </svg>
              </div>
            ) : (
              // Record Icon
              <div className="text-gray-300 group-hover:text-red-500 transition-colors" aria-hidden="true">
                <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-4.5 h-4.5 text-red-500">
                  <circle cx="12" cy="12" r="8" />
                </svg>
              </div>
            )}
            <span className={`text-[9px] font-semibold uppercase tracking-wider transition-colors ${
              isRecording ? "text-white font-bold" : "text-gray-400 group-hover:text-gray-300"
            }`}>
              {isRecordingStarting ? "Starting..." : isRecording ? "Stop Rec" : "Record"}
            </span>
          </button>
        )}
      </div>

      {/* Right Group: Action / End Call controls */}
      <div className="flex items-center gap-2">
        {isHost && onEndMeeting && (
          <button
            type="button"
            onClick={onEndMeeting}
            className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-[#1b1b1b]"
            aria-label="End Meeting for Everyone"
          >
            End Meeting
          </button>
        )}
        <button
          type="button"
          onClick={onLeave}
          className={`${
            isHost
              ? "bg-[#2d2d2d] hover:bg-[#3d3d3d] text-gray-300"
              : "bg-red-600 hover:bg-red-700 text-white"
          } font-bold px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-[#1b1b1b] flex items-center gap-1.5`}
          aria-label="Leave Meeting"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4.5 h-4.5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
          </svg>
          Leave
        </button>
      </div>
    </footer>
  );
}
