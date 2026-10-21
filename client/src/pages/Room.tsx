import { useCallback, useEffect, useRef, useState } from "react";
import Loading from "../components/Loading";
import ConnectionBadge from "../components/ConnectionBadge";
import ChatPanel from "../components/ChatPanel";
import { PeerSession } from "../services/peerSession";
import socketService from "../services/socketService";
import type {
  ConnectionPath,
  MatchedPayload,
  MatchPrefs,
  SearchScope,
  SignalMessage,
} from "../types/signaling";
import { newId } from "../types/chat";
import type { ChatEntry, ChatWireMessage } from "../types/chat";
import { describeSearch } from "../utils/locales";

interface RoomProps {
  prefs: MatchPrefs;
  localStream: MediaStream | null;
  onExit: () => void;
}

/** Hide "Stranger is typing…" if no refresh arrives within this time. */
const TYPING_TIMEOUT_MS = 4000;

const systemEntry = (text: string): ChatEntry => ({ id: newId(), from: "system", text, at: Date.now() });

export default function Room({ prefs, localStream, onExit }: RoomProps) {
  const isVideo = prefs.mode === "video";
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef<PeerSession | null>(null);
  const localStreamRef = useRef(localStream);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [roomId, setRoomId] = useState<string | null>(null);
  const [searchScope, setSearchScope] = useState<SearchScope | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState | null>(null);
  const [path, setPath] = useState<ConnectionPath | null>(null);
  const [chatEntries, setChatEntries] = useState<ChatEntry[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [strangerTyping, setStrangerTyping] = useState(false);

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

  const setTyping = useCallback((active: boolean) => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    setStrangerTyping(active);
    if (active) {
      typingTimerRef.current = setTimeout(() => setStrangerTyping(false), TYPING_TIMEOUT_MS);
    }
  }, []);

  /**
   * Close the current peer connection and clear the remote side.
   * Chat history stays on screen until the next match, so a goodbye can still be read.
   */
  const endSession = useCallback(() => {
    sessionRef.current?.close();
    sessionRef.current = null;
    setRoomId(null);
    setRemoteStream(null);
    setConnectionState(null);
    setPath(null);
    setChatOpen(false);
    setTyping(false);
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, [setTyping]);

  const handleChatMessage = useCallback((message: ChatWireMessage) => {
    if (message.type === "message") {
      setTyping(false);
      setChatEntries((entries) => [
        ...entries,
        { id: `s-${message.id}`, from: "stranger", text: message.text, at: Date.now() },
      ]);
    } else if (message.type === "typing") {
      setTyping(message.active);
    } else if (message.type === "bye") {
      // The server's "lobby" event follows and puts us back in the queue.
      endSession();
      setChatEntries((entries) => [...entries, systemEntry("Stranger left.")]);
    }
  }, [endSession, setTyping]);

  useEffect(() => {
    const socket = socketService.connect(prefs);

    // Ask to be matched once connected (and again after any reconnect,
    // since the server forgets queued users when the connection drops).
    const handleConnect = () => socket.emit("find");

    const handleQueueStatus = ({ scope }: { scope: SearchScope }) => setSearchScope(scope);

    const handleMatched = ({ roomId, polite, iceServers }: MatchedPayload) => {
      endSession();
      setRoomId(roomId);
      setSearchScope(null);
      setConnectionState("new");
      setChatEntries([systemEntry("You're connected to a stranger. Say hi!")]);
      sessionRef.current = new PeerSession({
        roomId,
        polite,
        iceServers,
        localStream: localStreamRef.current,
        sendSignal: (message) => socket.emit("signal", message),
        onRemoteStream: setRemoteStream,
        onConnectionStateChange: setConnectionState,
        onPathChange: setPath,
        onChatMessage: handleChatMessage,
        onChatOpenChange: setChatOpen,
      });
    };

    const handleSignal = (message: SignalMessage) => {
      const session = sessionRef.current;
      // Drop late signals from a previous match.
      if (session && session.roomId === message.roomId) {
        session.handleSignal(message);
      }
    };

    // The other person left or passed. Look for someone new.
    const handleLobby = () => {
      if (sessionRef.current) {
        endSession();
        setChatEntries((entries) => [...entries, systemEntry("Stranger left.")]);
      }
      socket.emit("find");
    };

    socket.on("connect", handleConnect);
    socket.on("queue-status", handleQueueStatus);
    socket.on("matched", handleMatched);
    socket.on("signal", handleSignal);
    socket.on("lobby", handleLobby);
    if (socket.connected) handleConnect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("queue-status", handleQueueStatus);
      socket.off("matched", handleMatched);
      socket.off("signal", handleSignal);
      socket.off("lobby", handleLobby);
      endSession();
      socketService.disconnect();
    };
  }, [prefs, endSession, handleChatMessage]);

  useEffect(() => () => {
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
  }, []);

  const handleSend = (text: string) => {
    const sent = sessionRef.current?.sendChat(text);
    if (!sent) return false;
    setChatEntries((entries) => [...entries, { id: sent.id, from: "me", text: sent.text, at: Date.now() }]);
    return true;
  };

  const handleTyping = (active: boolean) => sessionRef.current?.sendTyping(active);

  const handlePass = () => {
    if (!roomId) return;
    sessionRef.current?.sendBye();
    socketService.getSocket().emit("pass", { roomId });
    endSession();
    setChatEntries([]);
  };

  const handleExit = () => {
    sessionRef.current?.sendBye();
    endSession();
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    onExit();
  };

  const searching = !roomId;
  const statusText = describeSearch(prefs, searchScope);

  const chat = (
    <ChatPanel
      entries={searching && chatEntries.length === 0 ? [systemEntry(statusText)] : chatEntries}
      canSend={chatOpen}
      strangerTyping={strangerTyping}
      onSend={handleSend}
      onTyping={handleTyping}
      className={isVideo ? "h-72 md:h-auto md:min-h-[18rem]" : "flex-1"}
    />
  );

  return (
    <>
      <main className="flex-1 flex flex-col min-h-0">
        {isVideo ? (
          <div className="max-w-6xl w-full mx-auto px-4 py-6 grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
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
                <div className="flex flex-col items-center gap-1">
                  <Loading />
                  {searching && <p className="text-sm text-gray-500 px-4 text-center">{statusText}</p>}
                </div>
              )}
              {roomId && <ConnectionBadge state={connectionState} path={path} />}
            </div>
            <div className="md:col-span-2 flex flex-col">{chat}</div>
          </div>
        ) : (
          <div className="max-w-2xl w-full mx-auto px-4 py-6 flex-1 flex flex-col min-h-[24rem] gap-2">
            <div className="relative h-7 flex items-center">
              {roomId ? (
                <ConnectionBadge state={connectionState} path={path} />
              ) : (
                <p className="text-sm text-gray-500" aria-live="polite">{statusText}</p>
              )}
            </div>
            {chat}
          </div>
        )}
      </main>

      <div className="sticky bottom-0 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <button disabled={!roomId} className="btn btn-primary" onClick={handlePass}>
            Pass
          </button>
          <button className="btn btn-ghost" onClick={handleExit}>
            Exit
          </button>
        </div>
      </div>
    </>
  );
}
