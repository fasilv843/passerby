import VideoFrame from "./VideoFrame";
import VideoView from "./VideoView";

interface ParticipantTileProps {
  name: string;
  stream: MediaStream | null;
  cameraOff: boolean;
  micOff: boolean;
  /** Your own tile: muted so you don't hear yourself. */
  isSelf?: boolean;
}

/** One person in a group call: their video (or initial), name, and mic state. */
export default function ParticipantTile({ name, stream, cameraOff, micOff, isSelf = false }: ParticipantTileProps) {
  return (
    <VideoFrame>
      {/* Keep the element mounted while the camera is off, so their audio keeps playing. */}
      {stream ? <VideoView stream={stream} muted={isSelf} className={cameraOff ? "invisible" : ""} /> : null}
      {cameraOff || !stream ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="h-16 w-16 rounded-full bg-brand/20 text-brand text-2xl font-semibold flex items-center justify-center">
            {name.trim().charAt(0).toUpperCase() || "?"}
          </span>
        </div>
      ) : null}
      <div className="absolute left-2 bottom-2 rounded-md bg-black/60 px-2 py-0.5 text-xs text-white">
        {isSelf ? `${name} (you)` : name}
        {micOff ? <span className="ml-1 opacity-80">· muted</span> : null}
      </div>
    </VideoFrame>
  );
}
