import { useState, useRef, useCallback, useEffect } from "react";

export interface UseScreenShareReturn {
  isScreenSharing: boolean;
  isStarting: boolean;
  screenStream: MediaStream | null;
  error: string | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
}

export default function useScreenShare(
  localStream: MediaStream | null,
  replaceVideoTrack: (newTrack: MediaStreamTrack | null) => Promise<void>
): UseScreenShareReturn {
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(localStream);
  const screenStreamRef = useRef<MediaStream | null>(screenStream);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  const handleStopSharing = useCallback(async (
    activeStream: MediaStream | null,
    activeTrack: MediaStreamTrack | null
  ) => {
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;

    await replaceVideoTrack(cameraTrack);

    if (activeTrack) {
      activeTrack.stop();
    }
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
    }

    setScreenStream(null);
    setIsScreenSharing(false);
  }, [replaceVideoTrack]);

  const startScreenShare = async () => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getDisplayMedia
    ) {
      setError("Screen sharing is not supported by this browser.");
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const screenTrack = stream.getVideoTracks()[0];
      if (!screenTrack) {
        throw new Error("No video track found in screen stream.");
      }

      await replaceVideoTrack(screenTrack);

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Handle native browser "Stop sharing" bar click
      screenTrack.onended = () => {
        console.log("Screen share track ended natively by browser.");
        handleStopSharing(stream, screenTrack);
      };

    } catch (err: unknown) {
      console.error("Screen share start error:", err);
      const errorName = (err as { name?: string }).name;

      if (errorName === "NotAllowedError") {
        setError("Screen sharing permission was denied.");
      } else if (errorName === "AbortError") {
        setError("Screen sharing was cancelled.");
      } else if (errorName === "NotFoundError") {
        setError("No screen or window is available to share.");
      } else if (errorName === "NotReadableError") {
        setError("The selected screen could not be shared.");
      } else {
        setError("Unable to start screen sharing.");
      }
    } finally {
      setIsStarting(false);
    }
  };

  const stopScreenShare = async () => {
    const currentStream = screenStreamRef.current;
    const currentTrack = currentStream?.getVideoTracks()[0] ?? null;
    await handleStopSharing(currentStream, currentTrack);
  };

  // Prevent background display stream leaks on unmount
  useEffect(() => {
    return () => {
      const activeStream = screenStreamRef.current;
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    isScreenSharing,
    isStarting,
    screenStream,
    error,
    startScreenShare,
    stopScreenShare,
  };
}
