import { Link } from "react-router-dom";
import ActionBar from "../components/ActionBar";
import Loading from "../components/Loading";
import MatchPreferences from "../components/MatchPreferences";
import VideoFrame from "../components/VideoFrame";
import VideoView from "../components/VideoView";
import type { MatchPrefs } from "../types/signaling";

interface LobbyProps {
  prefs: MatchPrefs;
  onPrefsChange: (prefs: MatchPrefs) => void;
  onJoin: () => void;
  localStream: MediaStream | null;
  mediaError: string | null;
}

export default function Lobby({ prefs, onPrefsChange, onJoin, localStream, mediaError }: LobbyProps) {
  const isVideo = prefs.mode === "video";
  const canJoin = !isVideo || (localStream !== null && mediaError === null);

  return (
    <>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 grid-cols-1 md:grid-cols-2 items-start">
          <VideoFrame>
            <Preview isVideo={isVideo} stream={localStream} error={mediaError} />
          </VideoFrame>
          <div className="rounded-lg border p-4 md:p-6">
            <MatchPreferences prefs={prefs} onChange={onPrefsChange} />
          </div>
        </div>
      </main>

      <ActionBar>
        <Link to="/" className="btn btn-ghost">
          Go Back
        </Link>
        <button className="btn btn-primary" onClick={onJoin} disabled={!canJoin}>
          {isVideo ? "Join video chat" : "Join text chat"}
        </button>
      </ActionBar>
    </>
  );
}

function Preview({ isVideo, stream, error }: { isVideo: boolean; stream: MediaStream | null; error: string | null }) {
  if (!isVideo) {
    return <p className="text-gray-500 text-sm px-6 text-center">Text-only chat. Your camera and microphone stay off.</p>;
  }
  if (error) return <p className="text-red-500 text-sm px-6 text-center">{error}</p>;
  return stream ? <VideoView stream={stream} muted /> : <Loading />;
}
