import { useEffect, useRef } from "react";

interface VideoStageProps {
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  isVideoEnabled: boolean;
  remoteStream: MediaStream | null;
  localDisplayName: string;
  remoteDisplayName: string | null;
  isScreenSharing: boolean;
  screenStream: MediaStream | null;
}

export default function VideoStage({
  stream,
  isLoading,
  error,
  isVideoEnabled,
  remoteStream,
  localDisplayName,
  remoteDisplayName,
  isScreenSharing,
  screenStream,
}: VideoStageProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el) {
      if (stream && isVideoEnabled) {
        el.srcObject = stream;
      } else {
        el.srcObject = null;
      }
    }
  }, [stream, isVideoEnabled]);

  useEffect(() => {
    const el = remoteVideoRef.current;
    if (el) {
      el.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    const el = screenVideoRef.current;
    if (el) {
      el.srcObject = screenStream;
    }
  }, [screenStream]);

  const isLocalSharing = isScreenSharing;

  return (
    <section
      className="flex-1 bg-[#121212] flex items-stretch overflow-hidden"
      aria-label="Main Video Stage"
    >
      {/* Video frame — fills all available space between header and toolbar */}
      <div className="relative w-full bg-[#121212] flex flex-col items-center justify-center select-none overflow-hidden">
        {isLoading && !error && (
          <div className="flex flex-col items-center gap-3 px-4">
            <svg className="w-8 h-8 animate-spin text-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-sm font-medium text-gray-300">
              Starting camera and microphone...
            </p>
          </div>
        )}

        {!isLoading && error && (
          <div className="flex flex-col items-center gap-3 px-6 py-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-500/30 flex items-center justify-center text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.57-.598-3.75h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-red-400">
              {error === "Unable to establish a video connection." || error === "Unable to negotiate media connection."
                ? "Connection failed"
                : "Camera and microphone access is unavailable"}
            </h3>
            <p className="text-xs text-gray-400 leading-normal">
              {error}
            </p>
          </div>
        )}

        {!isLoading && !error && (
          <div className="relative w-full h-full">
            {/* 1. LOCAL SCREEN SHARE SCENARIO */}
            {isLocalSharing ? (
              <div className="w-full h-full relative">
                {/* Screen stream (Main area) - NOT mirrored, NOT muted */}
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-black"
                  aria-label="Local Screen Share Feed"
                />
                <div className="absolute bottom-4 left-4 bg-[#1e1e1e]/80 border border-[#3e3e3e]/50 backdrop-blur px-2.5 py-1 rounded text-xs font-semibold select-none z-10">
                  You are sharing your screen
                </div>

                  {remoteStream ? (
                  <div className="absolute bottom-4 right-4 w-1/4 min-w-[90px] sm:min-w-[130px] aspect-video bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg overflow-hidden shadow-lg flex items-center justify-center select-none z-20">
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover bg-black"
                      aria-label="Remote Video Feed (PiP)"
                    />
                    <div className="absolute bottom-1 left-1 bg-[#1e1e1e]/80 border border-[#3e3e3e]/50 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-semibold select-none z-25">
                      {remoteDisplayName || "Remote"}
                    </div>
                  </div>
                  ) : (
                  <div className="absolute bottom-4 right-4 w-1/4 min-w-[90px] sm:min-w-[130px] aspect-video bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg overflow-hidden shadow-lg flex items-center justify-center select-none z-20">
                    {stream && isVideoEnabled ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform scale-x-[-1] bg-black"
                        aria-label="Local Camera Feed (PiP)"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center p-1 text-center w-full h-full bg-[#1e1e1e]">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500 mb-0.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.843-3H13.5m-9-3h9A2.25 2.25 0 0 1 15.75 5.25v3M3 3l18 18" />
                        </svg>
                        <span className="text-[8px] sm:text-[9px] text-gray-400 font-semibold leading-tight">Camera off</span>
                      </div>
                    )}
                    <div className="absolute bottom-1 left-1 bg-[#1e1e1e]/80 border border-[#3e3e3e]/50 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-semibold select-none z-25">
                      {localDisplayName} (You)
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full relative">
                {remoteStream ? (
                  <div className="w-full h-full relative">
                    <video
                      ref={remoteVideoRef}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover bg-black"
                      aria-label="Remote Video Feed"
                    />
                    <div className="absolute bottom-4 left-4 bg-[#1e1e1e]/80 border border-[#3e3e3e]/50 backdrop-blur px-2.5 py-1 rounded text-xs font-semibold select-none z-10">
                      {remoteDisplayName || "Connecting..."}
                    </div>

                    {/* Local camera preview in PiP overlay (mirrored) */}
                    <div className="absolute bottom-4 right-4 w-1/4 min-w-[90px] sm:min-w-[130px] aspect-video bg-[#1e1e1e] border border-[#3e3e3e] rounded-lg overflow-hidden shadow-lg flex items-center justify-center select-none z-20">
                      {stream && isVideoEnabled ? (
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover transform scale-x-[-1] bg-black"
                          aria-label="Local Video Preview (PiP)"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center p-1 text-center w-full h-full bg-[#1e1e1e]">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500 mb-0.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.843-3H13.5m-9-3h9A2.25 2.25 0 0 1 15.75 5.25v3M3 3l18 18" />
                          </svg>
                          <span className="text-[8px] sm:text-[9px] text-gray-400 font-semibold leading-tight">Camera off</span>
                        </div>
                      )}
                      <div className="absolute bottom-1 left-1 bg-[#1e1e1e]/80 border border-[#3e3e3e]/50 backdrop-blur px-1.5 py-0.5 rounded text-[8px] font-semibold select-none z-25">
                        {localDisplayName} (You)
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-full relative flex items-center justify-center">
                    {stream && isVideoEnabled ? (
                      <>
                        <video
                          ref={localVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover transform scale-x-[-1] bg-black"
                          aria-label="Local Video Preview"
                        />
                        <div className="absolute bottom-4 left-4 bg-[#1e1e1e]/80 border border-[#3e3e3e]/50 backdrop-blur px-2.5 py-1 rounded text-xs font-semibold select-none z-10">
                          {localDisplayName} (You)
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-[#1b1b1b] border border-[#2d2d2d] flex items-center justify-center text-gray-500">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.843-3H13.5m-9-3h9A2.25 2.25 0 0 1 15.75 5.25v3M3 3l18 18" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-gray-400">Camera is off</p>
                        <p className="text-xs text-gray-500 font-medium">{localDisplayName} (You)</p>
                      </div>
                    )}

                    {/* Waiting badge — overlaid at bottom center when no remote peer */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#1e1e1e]/80 border border-[#3e3e3e]/50 backdrop-blur px-3 py-1.5 rounded-full text-xs text-gray-400 font-medium select-none z-10">
                      Waiting for others to join…
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
