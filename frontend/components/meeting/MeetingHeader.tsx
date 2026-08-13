interface MeetingHeaderProps {
  meetingId: string;
  connectionStatus: "Connecting" | "Connected" | "Disconnected" | "Error" | "Reconnecting";
  rtcStatus: RTCPeerConnectionState;
  isRecording?: boolean;
  recordingDuration?: number;
  isHost?: boolean;
}

export default function MeetingHeader({
  meetingId,
  connectionStatus,
  rtcStatus,
  isRecording = false,
  recordingDuration = 0,
  isHost = false,
}: MeetingHeaderProps) {
  // Determine WebSocket indicator dot color
  let wsDotColor = "bg-yellow-500";
  if (connectionStatus === "Connected") {
    wsDotColor = "bg-green-500";
  } else if (connectionStatus === "Disconnected") {
    wsDotColor = "bg-gray-500";
  } else if (connectionStatus === "Error") {
    wsDotColor = "bg-red-500";
  } else if (connectionStatus === "Reconnecting") {
    wsDotColor = "bg-orange-500";
  }

  // Determine WebRTC indicator dot color based on RTCPeerConnectionState
  let rtcDotColor = "bg-gray-500"; // default: new / closed
  let rtcStatusLabel = "Disconnected";

  if (rtcStatus === "connected") {
    rtcDotColor = "bg-green-500";
    rtcStatusLabel = "Connected";
  } else if (rtcStatus === "connecting") {
    rtcDotColor = "bg-yellow-500";
    rtcStatusLabel = "Connecting";
  } else if (rtcStatus === "failed") {
    rtcDotColor = "bg-red-500";
    rtcStatusLabel = "Failed";
  } else if (rtcStatus === "disconnected") {
    rtcDotColor = "bg-orange-500";
    rtcStatusLabel = "Disconnected";
  } else if (rtcStatus === "new") {
    rtcDotColor = "bg-gray-500";
    rtcStatusLabel = "Ready";
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

  return (
    <header className="w-full bg-[#1b1b1b] border-b border-[#2d2d2d] px-6 py-3 flex items-center justify-between text-white select-none">
      {/* Brand logo & Meeting ID */}
      <div className="flex items-center gap-4">
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
          {isHost && (
            <span className="inline-block text-[9px] bg-red-500/10 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none animate-pulse">
              Host
            </span>
          )}
        </div>
        <div className="h-4 w-px bg-[#3d3d3d]" aria-hidden="true" />
        <div className="flex items-center gap-1.5 font-mono text-xs text-gray-300">
          <span className="text-gray-500 font-sans uppercase font-bold text-[10px] tracking-wider">
            ID:
          </span>
          <span className="select-all font-semibold">{meetingId}</span>
        </div>
      </div>

      {/* Connection & Recording Indicators Group */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Pulsing Recording Indicator */}
        {isRecording && (
          <div className="flex items-center gap-1.5 bg-red-950/45 border border-red-500/25 px-2.5 py-0.5 rounded text-red-400 select-none animate-pulse">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-hidden="true" />
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider">
              Recording <span className="font-mono">{formatDuration(recordingDuration)}</span>
            </span>
          </div>
        )}

        {/* WebSocket Connection Status */}
        <div className="flex items-center gap-2" aria-label={`WebSocket Status: ${connectionStatus}`}>
          <span className={`h-2 w-2 rounded-full ${wsDotColor} ${
            connectionStatus === "Connecting" || connectionStatus === "Reconnecting" ? "animate-pulse" : ""
          }`} aria-hidden="true" />
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400">
            WS: <span className="text-gray-200">
              {connectionStatus === "Reconnecting" ? "Reconnecting..." : connectionStatus}
            </span>
          </span>
        </div>

        {/* WebRTC Connection Status */}
        <div className="flex items-center gap-2" aria-label={`WebRTC Status: ${rtcStatusLabel}`}>
          <span className={`h-2 w-2 rounded-full ${rtcDotColor} ${rtcStatus === "connecting" ? "animate-pulse" : ""}`} aria-hidden="true" />
          <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-gray-400">
            WebRTC: <span className="text-gray-200">{rtcStatusLabel}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
