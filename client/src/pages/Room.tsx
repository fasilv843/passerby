import { useCallback, useEffect, useRef, useState } from "react";
import Loading from "../components/Loading";
import ConnectionBadge from "../components/ConnectionBadge";
import { PeerSession } from "../services/peerSession";
import socketService from "../services/socketService";
import type { ConnectionPath, MatchedPayload, SignalMessage } from "../types/signaling";

interface RoomProps {
  localStream: MediaStream | null;
  onExit: () => void;
}

export default function Room({ localStream, onExit }: RoomProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const localStreamRef = useRef(localStream);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [path, setPath] = useState<ConnectionPath | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  /** Close the current peer connection and clear the remote side. */
  const endSession = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setRoomId(null);
    setRemoteStream(null);
    setConnectionState(null);
    setPath(null);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    const socket = socketService.connect();

    const handleMatched = ({ roomId, polite, iceServers }: MatchedPayload) => {
      endSession();
      setRoomId(roomId);
      setConnectionState("new");
      sessionRef.current = new PeerSession({
        roomId,
        polite,
        iceServers,
        localStream: localStreamRef.current,
        sendSignal: (message) => socket.emit("signal", message),
        onRemoteStream: setRemoteStream,
        onConnectionStateChange: setConnectionState,
        onPathChange: setPath,
      });
    };

    const handleSignal = (message: SignalMessage) => {
      const session = sessionRef.current;
      // Drop late signals from a previous match.
      if (session && session.roomId === message.roomId) {
        session.handleSignal(message);
      }
    };

    // The other person left or passed; the server has put us back in the queue.
    const handleLobby = () => endSession();

    socket.on("matched", handleMatched);
    socket.on("signal", handleSignal);
    socket.on("lobby", handleLobby);

    return () => {
      socket.off("matched", handleMatched);
      socket.off("signal", handleSignal);
      socket.off("lobby", handleLobby);
      endSession();
      socketService.disconnect();
    };
  }, [endSession]);

  const handlePass = () => {
    if (!roomId) return;
    socketService.getSocket().emit("pass", { roomId });
    endSession();
  };

  const handleExit = () => {
    endSession();
    localStream?.getTracks().forEach((track) => track.stop());
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    onExit();
  };

  return (
    <>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
          <div className="aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
            {localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <Loading />
            )}
          </div>
          <div className="relative aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <Loading />
            )}
            {roomId && <ConnectionBadge state={connectionState} path={path} />}
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <button disabled={!roomId} className="btn btn-primary" onClick={handlePass}>
            Pass
          </button>
          <button className="btn btn-primary" onClick={handleExit}>
            Exit
          </button>
        </div>
      </div>
    </>
  );
}
