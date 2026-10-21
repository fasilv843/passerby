import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import MatchPreferences from "../components/MatchPreferences";
import Loading from "../components/Loading";
import type { MatchPrefs } from "../types/signaling";

interface LobbyProps {
  prefs: MatchPrefs;
  onPrefsChange: (prefs: MatchPrefs) => void;
  onJoin: () => void;
  localStream: MediaStream | null;
  permissionError: string | null;
}

export default function Lobby({ prefs, onPrefsChange, onJoin, permissionError, localStream }: LobbyProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const isVideo = prefs.mode === "video";
  const canJoin = !isVideo || (!!localStream && !permissionError);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      if (localStream) localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  return (
    <>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 grid-cols-1 md:grid-cols-2 items-start">
          <div className="aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
            {!isVideo ? (
              <p className="text-gray-500 text-sm px-6 text-center">
                Text-only chat. Your camera and microphone stay off.
              </p>
            ) : permissionError ? (
              <p className="text-red-500 text-sm px-6 text-center">{permissionError}</p>
            ) : localStream ? (
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
          <div className="rounded-lg border p-4 md:p-6">
            <MatchPreferences prefs={prefs} onChange={onPrefsChange} />
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <Link to="/" className="btn btn-ghost">
            Go Back
          </Link>
          <button className="btn btn-primary" onClick={onJoin} disabled={!canJoin}>
            {isVideo ? "Join video chat" : "Join text chat"}
          </button>
        </div>
      </div>
    </>
  );
}
