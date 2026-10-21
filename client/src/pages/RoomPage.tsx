import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLocalMedia } from "../hooks/useLocalMedia";
import { usePrefs } from "../hooks/usePrefs";
import Lobby from "./Lobby";
import Room from "./Room";

/** The lobby (pick how to talk) and the room (talk), sharing preferences and the camera. */
export default function RoomPage() {
  const [joined, setJoined] = useState(false);
  const [prefs, setPrefs] = usePrefs();
  // The camera is only needed for video mode.
  const media = useLocalMedia(prefs.mode === "video");
  const navigate = useNavigate();

  return joined ? (
    <Room prefs={prefs} localStream={media.stream} onExit={() => navigate("/")} />
  ) : (
    <Lobby
      prefs={prefs}
      onPrefsChange={setPrefs}
      onJoin={() => setJoined(true)}
      localStream={media.stream}
      mediaError={media.error}
    />
  );
}
