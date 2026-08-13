"use client";

import React, { useEffect, useRef } from "react";

interface PreJoinPreviewProps {
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  isVideoEnabled: boolean;
}

export default function PreJoinPreview({
  stream,
  isLoading,
  error,
  isVideoEnabled,
}: PreJoinPreviewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoElement = videoRef.current;
    if (videoElement) {
      if (stream && isVideoEnabled) {
        videoElement.srcObject = stream;
      } else {
        videoElement.srcObject = null;
      }
    }
  }, [stream, isVideoEnabled]);

  return (
    <div className="w-full aspect-video bg-[#121212] border border-[#2d2d2d] rounded-2xl overflow-hidden relative shadow-inner flex items-center justify-center select-none group">
      {isLoading ? (
        // Loading State
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 animate-spin text-brand" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
            Initializing camera preview...
          </span>
        </div>
      ) : error ? (
        // Error State
        <div className="p-6 text-center max-w-sm space-y-3">
          <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3Z" />
            </svg>
          </div>
          <p className="text-xs text-gray-400 font-semibold leading-relaxed">
            {error}
          </p>
          <p className="text-[10px] text-gray-500 font-medium">
            You can still join the meeting without video/audio if needed.
          </p>
        </div>
      ) : isVideoEnabled && stream ? (
        // Live Mirrored Video Preview
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
          aria-label="Local camera preview"
        />
      ) : (
        // Camera Off State
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#1b1b1b] border border-[#2d2d2d] flex items-center justify-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M12 18.75H4.5a2.25 2.25 0 0 1-2.25-2.25V9m12.843-3H13.5m-9-3h9A2.25 2.25 0 0 1 15.75 5.25v3M3 3l18 18" />
            </svg>
          </div>
          <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">
            Camera is off
          </span>
        </div>
      )}
    </div>
  );
}
