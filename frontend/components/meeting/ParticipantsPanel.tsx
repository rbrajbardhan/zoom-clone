import React from "react";

export interface MeetingParticipant {
  id: string;
  displayName: string;
  isLocal: boolean;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing?: boolean;
  isHost?: boolean;
}

interface ParticipantsPanelProps {
  participants: MeetingParticipant[];
  isOpen: boolean;
  onClose: () => void;
  localAudioEnabled: boolean;
  localVideoEnabled: boolean;
}

export default function ParticipantsPanel({
  participants,
  isOpen,
  onClose,
  localAudioEnabled,
  localVideoEnabled,
}: ParticipantsPanelProps) {
  if (!isOpen) return null;

  const count = participants.length;
  const participantLabel = count === 1 ? "1 participant" : `${count} participants`;

  return (
    <aside
      className="w-full md:w-[320px] bg-[#1b1b1b] border-l border-[#2d2d2d] flex flex-col h-full text-white shadow-xl animate-slide-in relative z-45"
      role="complementary"
      aria-label="Participants Panel"
    >
      {/* Header section */}
      <div className="p-4 border-b border-[#2d2d2d] flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-100">Participants</h2>
          <p className="text-xs text-gray-400 font-semibold">{participantLabel}</p>
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

      {/* Participants list container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {participants.map((p) => {
          const micOn = p.isLocal ? localAudioEnabled : p.isAudioEnabled;
          const camOn = p.isLocal ? localVideoEnabled : p.isVideoEnabled;
          const isSharing = p.isScreenSharing;

          return (
            <div
              key={p.id}
              className="flex items-start justify-between bg-[#121212] border border-[#2d2d2d] rounded-xl p-3.5"
            >
              {/* User details */}
              <div className="flex items-start gap-2.5 min-w-0">
                <span className="h-2 w-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-100 truncate">
                    {p.displayName}
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {p.isLocal ? (
                      <span className="inline-block text-[9px] bg-brand/10 border border-brand/20 text-brand px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none mt-1">
                        You
                      </span>
                    ) : (
                      <span className="inline-block text-[9px] bg-[#252525] border border-[#333] text-gray-400 px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider select-none mt-1">
                        Connected
                      </span>
                    )}
                    {p.isHost && (
                      <span className="inline-block text-[9px] bg-red-500/10 border border-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none mt-1">
                        Host
                      </span>
                    )}
                    {isSharing && (
                      <span className="inline-block text-[9px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider select-none mt-1">
                        🖥️ Sharing screen
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status details for media */}
              <div className="flex items-center gap-1.5 text-gray-400">
                {/* Mic Status Icon */}
                <div
                  className={`p-1.5 rounded-lg border ${
                    micOn ? "border-[#2d2d2d] bg-[#1b1b1b]" : "border-red-500/20 bg-red-950/20 text-red-400"
                  }`}
                  title={micOn ? "Microphone active" : "Microphone muted"}
                  aria-label={micOn ? "Microphone active" : "Microphone muted"}
                >
                  {micOn ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  )}
                </div>

                {/* Camera Status Icon */}
                <div
                  className={`p-1.5 rounded-lg border ${
                    camOn ? "border-[#2d2d2d] bg-[#1b1b1b]" : "border-red-500/20 bg-red-950/20 text-red-400"
                  }`}
                  title={camOn ? "Camera active" : "Camera disabled"}
                  aria-label={camOn ? "Camera active" : "Camera disabled"}
                >
                  {camOn ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.843-3H13.5m-9-3h9A2.25 2.25 0 0 1 15.75 5.25v3M3 3l18 18" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
