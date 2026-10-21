import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ActionBar from "../components/ActionBar";
import { useCreateGroupRoom } from "../hooks/useCreateGroupRoom";
import { useLocalMedia } from "../hooks/useLocalMedia";
import { isValidRoomId } from "../lib/groupLinks";
import { loadDisplayName, saveDisplayName } from "../services/prefsStorage";
import GroupLobby from "./GroupLobby";
import GroupRoom from "./GroupRoom";

/**
 * Group rooms section:
 *   /group           start a new room
 *   /group/:roomId   lobby (name + camera check), then the call
 */
export default function GroupPage() {
  const { roomId } = useParams();
  if (roomId === undefined) return <StartGroup />;
  if (!isValidRoomId(roomId)) return <InvalidLink />;
  // key: a different room in the URL starts fresh.
  return <JoinGroup key={roomId} roomId={roomId} />;
}

function JoinGroup({ roomId }: { roomId: string }) {
  const [joined, setJoined] = useState(false);
  const [displayName, setDisplayName] = useState(loadDisplayName);
  const media = useLocalMedia(true);
  const navigate = useNavigate();

  const join = () => {
    saveDisplayName(displayName);
    setJoined(true);
  };

  return joined ? (
    <GroupRoom roomId={roomId} displayName={displayName.trim()} localStream={media.stream} onLeave={() => navigate("/")} />
  ) : (
    <GroupLobby
      roomId={roomId}
      displayName={displayName}
      onDisplayNameChange={setDisplayName}
      localStream={media.stream}
      mediaError={media.error}
      onJoin={join}
    />
  );
}

function StartGroup() {
  const navigate = useNavigate();
  const { create, creating, error } = useCreateGroupRoom((roomId) => navigate(`/group/${roomId}`));

  return (
    <>
      <main className="flex-1">
        <div className="max-w-xl mx-auto px-4 py-16 flex flex-col gap-4">
          <h1 className="text-3xl font-bold tracking-tight">Group call</h1>
          <p className="text-gray-600">
            Start a room and share the link with up to five friends. Video goes through our media server, so
            everyone only uploads once.
          </p>
          {error ? <p className="text-red-500 text-sm">{error}</p> : null}
        </div>
      </main>
      <ActionBar>
        <Link to="/" className="btn btn-ghost">Go Back</Link>
        <button className="btn btn-primary" onClick={create} disabled={creating}>
          {creating ? "Creating…" : "Create a room"}
        </button>
      </ActionBar>
    </>
  );
}

function InvalidLink() {
  return (
    <main className="flex-1">
      <div className="max-w-xl mx-auto px-4 py-16 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">That link doesn't look right</h1>
        <p className="text-gray-600">Check it was copied in full, or start a new room.</p>
        <Link to="/group" className="btn btn-primary w-fit">Start a group call</Link>
      </div>
    </main>
  );
}
