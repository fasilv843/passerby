import ActionBar from "../components/ActionBar";
import InviteLink from "../components/InviteLink";
import Loading from "../components/Loading";
import ParticipantTile from "../components/ParticipantTile";
import { useGroupCall } from "../hooks/useGroupCall";
import { groupRoomUrl } from "../lib/groupLinks";
import { gridColumnsClass } from "../lib/gridLayout";

interface GroupRoomProps {
  roomId: string;
  displayName: string;
  localStream: MediaStream | null;
  onLeave: () => void;
}

export default function GroupRoom({ roomId, displayName, localStream, onLeave }: GroupRoomProps) {
  const { state, controller } = useGroupCall(roomId, displayName, localStream);
  const tileCount = state.participants.length + 1;

  if (state.status === "failed") {
    return (
      <main className="flex-1">
        <div className="max-w-xl mx-auto px-4 py-16 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">Couldn't join</h1>
          <p className="text-gray-600">{state.error}</p>
          <button className="btn btn-primary w-fit" onClick={onLeave}>Back to home</button>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4">
          {state.status === "joining" ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="h-5 w-5"><Loading /></div> Joining…
            </div>
          ) : state.participants.length === 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-gray-600">You're the only one here. Share the link to invite people.</p>
              <InviteLink url={groupRoomUrl(roomId)} />
            </div>
          ) : null}

          <div className={`grid gap-4 ${gridColumnsClass(tileCount)}`}>
            <ParticipantTile
              name={displayName}
              stream={localStream}
              cameraOff={!state.cameraOn}
              micOff={!state.micOn}
              isSelf
            />
            {state.participants.map((p) => (
              <ParticipantTile key={p.peerId} name={p.displayName} stream={p.stream} cameraOff={p.cameraOff} micOff={p.micOff} />
            ))}
          </div>
        </div>
      </main>

      <ActionBar>
        <button
          className="btn btn-ghost"
          onClick={() => controller.toggleMic()}
          disabled={!localStream}
          aria-pressed={!state.micOn}
        >
          {state.micOn ? "Mute" : "Unmute"}
        </button>
        <button
          className="btn btn-ghost"
          onClick={() => controller.toggleCamera()}
          disabled={!localStream}
          aria-pressed={!state.cameraOn}
        >
          {state.cameraOn ? "Camera off" : "Camera on"}
        </button>
        <button className="btn btn-primary" onClick={onLeave}>
          Leave
        </button>
      </ActionBar>
    </>
  );
}
