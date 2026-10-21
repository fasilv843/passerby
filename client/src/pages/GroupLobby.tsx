import { Link } from "react-router-dom";
import ActionBar from "../components/ActionBar";
import InviteLink from "../components/InviteLink";
import Loading from "../components/Loading";
import VideoFrame from "../components/VideoFrame";
import VideoView from "../components/VideoView";
import { groupRoomUrl } from "../lib/groupLinks";

interface GroupLobbyProps {
  roomId: string;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  localStream: MediaStream | null;
  mediaError: string | null;
  onJoin: () => void;
}

/** Check your camera, pick a name, and share the link before joining. */
export default function GroupLobby({
  roomId,
  displayName,
  onDisplayNameChange,
  localStream,
  mediaError,
  onJoin,
}: GroupLobbyProps) {
  const waitingForCamera = !localStream && !mediaError;
  const canJoin = displayName.trim().length > 0 && !waitingForCamera;

  return (
    <>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-6 grid-cols-1 md:grid-cols-2 items-start">
          <VideoFrame>
            {mediaError ? (
              <p className="text-red-500 text-sm px-6 text-center">{mediaError} You can still join and listen.</p>
            ) : localStream ? (
              <VideoView stream={localStream} muted />
            ) : (
              <Loading />
            )}
          </VideoFrame>

          <form
            className="rounded-lg border p-4 md:p-6 flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (canJoin) onJoin();
            }}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Your name</span>
              <input
                id="group-display-name"
                value={displayName}
                maxLength={30}
                autoComplete="nickname"
                onChange={(e) => onDisplayNameChange(e.target.value)}
                placeholder="How others will see you"
                className="rounded-md border px-3 py-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">Invite others</span>
              <InviteLink url={groupRoomUrl(roomId)} />
            </div>
            {/* Lets Enter in the name field join. */}
            <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
          </form>
        </div>
      </main>

      <ActionBar>
        <Link to="/" className="btn btn-ghost">Go Back</Link>
        <button className="btn btn-primary" onClick={onJoin} disabled={!canJoin}>
          {mediaError ? "Join without camera" : "Join room"}
        </button>
      </ActionBar>
    </>
  );
}
