import { useState, useCallback, useRef, useEffect } from "react";

export interface UseMeetingRecordingReturn {
  isRecording: boolean;
  isStarting: boolean;
  recordingDuration: number;
  recordingError: string | null;
  recordingBlob: Blob | null;
  recordingSize: number;
  startRecording: (localStream: MediaStream | null, screenStream: MediaStream | null) => void;
  stopRecording: () => void;
  downloadRecording: (meetingId: string) => void;
  discardRecording: () => void;
  clearError: () => void;
}

export default function useMeetingRecording(): UseMeetingRecordingReturn {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingSize, setRecordingSize] = useState<number>(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>("");

  const getSupportedMimeType = (): string => {
    const candidateMimeTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];
    for (const mimeType of candidateMimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return mimeType;
      }
    }
    return "";
  };

  const startRecording = useCallback((
    localStream: MediaStream | null,
    screenStream: MediaStream | null
  ) => {
    setRecordingError(null);
    setRecordingBlob(null);
    setRecordingSize(0);
    setRecordingDuration(0);

    if (typeof window === "undefined" || !window.MediaRecorder) {
      setRecordingError("Recording is not supported by this browser.");
      return;
    }

    const mime = getSupportedMimeType();
    if (!mime) {
      setRecordingError("No supported recording video/audio codecs found in this browser.");
      return;
    }
    mimeTypeRef.current = mime;

    setIsStarting(true);

    try {
      // Prefer screen stream video track, fallback to camera
      const videoTrack = screenStream?.getVideoTracks()[0] || localStream?.getVideoTracks()[0];
      const audioTrack = localStream?.getAudioTracks()[0];

      if (!videoTrack && !audioTrack) {
        throw new Error("No active camera, microphone, or screen sharing tracks are available to record.");
      }

      const recordStream = new MediaStream();
      if (videoTrack) recordStream.addTrack(videoTrack);
      if (audioTrack) recordStream.addTrack(audioTrack);

      chunksRef.current = [];

      const recorder = new MediaRecorder(recordStream, { mimeType: mime });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
        setRecordingBlob(finalBlob);
        setRecordingSize(finalBlob.size);
        setIsRecording(false);
        setIsStarting(false);
      };

      recorder.start(1000);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (err: unknown) {
      console.error("Failed to start MediaRecorder:", err);
      const errName = (err as { name?: string }).name;

      if (errName === "NotSupportedError") {
        setRecordingError("Recording is not supported by this browser.");
      } else if (errName === "SecurityError") {
        setRecordingError("Recording is blocked by browser security settings.");
      } else if (errName === "InvalidStateError") {
        setRecordingError("Recording could not be started right now.");
      } else {
        const errMessage = (err as { message?: string }).message;
        setRecordingError(errMessage || "Unable to start recording.");
      }
      setIsRecording(false);
    } finally {
      setIsStarting(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    mediaRecorderRef.current = null;
  }, []);

  const downloadRecording = useCallback((meetingId: string) => {
    const blob = recordingBlob;
    if (!blob) return;

    try {
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString()
        .replace(/:/g, "-")
        .replace(/\..+/, "");

      const filename = `zoom-clone-${meetingId}-${timestamp}.webm`;

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to trigger local file download:", err);
    }
  }, [recordingBlob]);

  const discardRecording = useCallback(() => {
    setRecordingBlob(null);
    setRecordingSize(0);
    setRecordingDuration(0);
    setRecordingError(null);
  }, []);

  const clearError = useCallback(() => {
    setRecordingError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  return {
    isRecording,
    isStarting,
    recordingDuration,
    recordingError,
    recordingBlob,
    recordingSize,
    startRecording,
    stopRecording,
    downloadRecording,
    discardRecording,
    clearError,
  };
}
