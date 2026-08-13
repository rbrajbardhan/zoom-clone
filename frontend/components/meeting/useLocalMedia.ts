import { useEffect, useState, useRef, useCallback } from "react";

export interface UseLocalMediaReturn {
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  stopMedia: () => void;
}

export default function useLocalMedia(enabled: boolean = true): UseLocalMediaReturn {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState<boolean>(true);

  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsLoading(false);
      return;
    }

    let active = true;

    async function getMedia() {
      setIsLoading(true);
      setError(null);

      // 1. Browser capability check
      if (
        typeof window === "undefined" ||
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        if (active) {
          setError("Your browser does not support camera and microphone access.");
          setIsLoading(false);
        }
        return;
      }

      try {
        // 2. Request camera and microphone access
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });

        if (active) {
          streamRef.current = mediaStream;
          setStream(mediaStream);
          setIsAudioEnabled(true);
          setIsVideoEnabled(true);
        } else {
          // Clean up if component was unmounted before promise finished
          mediaStream.getTracks().forEach((track) => track.stop());
        }
      } catch (err: unknown) {
        if (active) {
          console.error("Local media access error:", err);
          const errorName = (err as { name?: string }).name;

          // 3. User-friendly error mapping
          if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
            setError("Camera and microphone permission was denied.");
          } else if (errorName === "NotFoundError" || errorName === "DevicesNotFoundError") {
            setError("No camera or microphone was found.");
          } else if (errorName === "NotReadableError" || errorName === "TrackStartError") {
            setError("The camera or microphone is already being used by another application.");
          } else {
            setError("Unable to access camera and microphone.");
          }
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    getMedia();

    // 4. Cleanup on unmount
    return () => {
      active = false;
      const currentStream = streamRef.current;
      if (currentStream) {
        currentStream.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
    };
  }, [enabled]);

  const toggleAudio = useCallback(() => {
    const activeStream = streamRef.current;
    if (activeStream) {
      const audioTracks = activeStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !track.enabled;
        setIsAudioEnabled(track.enabled);
      });
    }
  }, []);

  const toggleVideo = useCallback(() => {
    const activeStream = streamRef.current;
    if (activeStream) {
      const videoTracks = activeStream.getVideoTracks();
      videoTracks.forEach((track) => {
        track.enabled = !track.enabled;
        setIsVideoEnabled(track.enabled);
      });
    }
  }, []);

  const stopMedia = useCallback(() => {
    const activeStream = streamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  return {
    stream,
    isLoading,
    error,
    isAudioEnabled,
    isVideoEnabled,
    toggleAudio,
    toggleVideo,
    stopMedia,
  };
}
