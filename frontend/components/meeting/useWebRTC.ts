import { useEffect, useRef, useState, useCallback } from "react";
import { WebSocketMessage } from "@/lib/types";

export interface UseWebRTCReturn {
  remoteStream: MediaStream | null;
  connectionState: RTCPeerConnectionState;
  error: string | null;
  replaceVideoTrack: (newTrack: MediaStreamTrack | null) => Promise<void>;
}

export default function useWebRTC(
  meetingId: string,
  localStream: MediaStream | null,
  isSocketConnected: boolean,
  sendSignal: (
    signalType: "offer" | "answer" | "ice-candidate",
    data: { sdp: RTCSessionDescriptionInit } | { candidate: RTCIceCandidateInit }
  ) => void,
  onMessageReceivedRef: React.MutableRefObject<((message: WebSocketMessage) => void) | null>,
  isHost: boolean
): UseWebRTCReturn {
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>("new");
  const [error, setError] = useState<string | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  
  // Caches screen share track to swap back to camera later
  const replacedVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  // Prevent peer connection recreation on input/stream changes
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const isSocketConnectedRef = useRef<boolean>(isSocketConnected);
  const isHostRef = useRef<boolean>(isHost);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    isSocketConnectedRef.current = isSocketConnected;
  }, [isSocketConnected]);

  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  const closePeerConnection = useCallback(() => {
    const pc = peerConnectionRef.current;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }
    peerConnectionRef.current = null;
    setRemoteStream(null);
    setConnectionState("new");
    pendingCandidatesRef.current = [];
  }, []);

  const getOrCreatePeerConnection = useCallback((): RTCPeerConnection => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    console.log("Initializing RTCPeerConnection...");
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && isSocketConnectedRef.current) {
        sendSignal("ice-candidate", {
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.ontrack = (event) => {
      console.log("WebRTC track received:", event.track.kind);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        setRemoteStream((prev) => {
          const stream = prev ?? new MediaStream();
          if (!stream.getTracks().find((t) => t.id === event.track.id)) {
            stream.addTrack(event.track);
          }
          return stream;
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log("WebRTC connection state change:", pc.connectionState);
      setConnectionState(pc.connectionState);
      if (pc.connectionState === "failed") {
        setError("Unable to establish a video connection.");
      }
    };

    const currentLocalStream = localStreamRef.current;
    if (currentLocalStream) {
      console.log("Adding local tracks to PeerConnection...");
      currentLocalStream.getTracks().forEach((track) => {
        if (track.kind === "video" && replacedVideoTrackRef.current) {
          console.log("PeerConnection: Adding screen share video track override.");
          pc.addTrack(replacedVideoTrackRef.current, currentLocalStream);
        } else {
          pc.addTrack(track, currentLocalStream);
        }
      });
    }

    peerConnectionRef.current = pc;
    return pc;
  }, [sendSignal]);

  const replaceVideoTrack = useCallback(async (newTrack: MediaStreamTrack | null) => {
    replacedVideoTrackRef.current = newTrack;
    const pc = peerConnectionRef.current;
    if (!pc) {
      console.log("replaceVideoTrack: Connection not active yet. Track cached for start.");
      return;
    }

    const senders = pc.getSenders();
    const videoSender = senders.find((s) => s.track?.kind === "video");
    if (videoSender) {
      console.log("replaceVideoTrack: Replacing outgoing WebRTC video track.");
      await videoSender.replaceTrack(newTrack);
    } else {
      console.warn("replaceVideoTrack: Video sender not found on active connection.");
    }
  }, []);

  const processPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const candidates = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const cand of candidates) {
      try {
        console.log("Processing pending ICE candidate...");
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.error("Error processing pending candidate:", err);
      }
    }
  }, []);

  const handleIncomingMessage = useCallback(async (message: WebSocketMessage) => {
    try {
      if (message.type === "participant_joined") {
        if (isHostRef.current) {
          console.log("Participant joined room and local is Host. Generating WebRTC offer...");
          const pc = getOrCreatePeerConnection();
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sendSignal("offer", { sdp: offer });
        } else {
          console.log("Participant joined room and local is NOT Host. Waiting for offer...");
        }
      } else if (message.type === "participant_left") {
        console.log("Remote participant left. Terminating WebRTC connection...");
        closePeerConnection();
      } else if (message.type === "signal") {
        if (message.signal_type === "offer") {
          console.log("Received WebRTC offer. Generating answer...");
          const pc = getOrCreatePeerConnection();
          await pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
          await processPendingCandidates(pc);
          
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          sendSignal("answer", { sdp: answer });
        } else if (message.signal_type === "answer") {
          console.log("Received WebRTC answer. Completing handshake...");
          const pc = peerConnectionRef.current;
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(message.data.sdp));
            await processPendingCandidates(pc);
          }
        } else if (message.signal_type === "ice-candidate") {
          const cand = message.data.candidate;
          const pc = peerConnectionRef.current;
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          } else {
            console.log("Remote description not set yet. Queueing ICE candidate...");
            pendingCandidatesRef.current.push(cand);
          }
        }
      }
    } catch (err) {
      console.error("WebRTC message processing error:", err);
      setError("Unable to negotiate media connection.");
    }
  }, [getOrCreatePeerConnection, closePeerConnection, processPendingCandidates, sendSignal]);

  useEffect(() => {
    onMessageReceivedRef.current = (message: WebSocketMessage) => {
      handleIncomingMessage(message);
    };
    return () => {
      onMessageReceivedRef.current = null;
    };
  }, [handleIncomingMessage, onMessageReceivedRef]);

  useEffect(() => {
    return () => {
      closePeerConnection();
    };
  }, [closePeerConnection]);

  return { remoteStream, connectionState, error, replaceVideoTrack };
}
