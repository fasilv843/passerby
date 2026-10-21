import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Lobby from "./Lobby";
import Room from "./Room";
import type { MatchPrefs } from "../types/signaling";
import { loadPrefs, savePrefs } from "../utils/locales";

export default function RoomPage() {
  const [joined, setJoined] = useState(false);
  const [prefs, setPrefs] = useState<MatchPrefs>(loadPrefs);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => savePrefs(prefs), [prefs]);

  // The camera is only needed for video mode. Turning it off when switching
  // to text-only (or leaving the page) also stops the camera light.
  useEffect(() => {
    if (prefs.mode !== "video") {
      setLocalStream(null);
      setPermissionError(null);
      return;
    }

    let cancelled = false;
    let acquired: MediaStream | null = null;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        acquired = stream;
        setPermissionError(null);
        setLocalStream(stream);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(err, "permission error");
        if (err.name === "NotAllowedError") {
          setPermissionError("Camera and microphone permission required. You can still use text-only chat.");
        } else if (err.name === "NotFoundError") {
          setPermissionError("Camera or microphone not found. You can still use text-only chat.");
        } else {
          setPermissionError("Unable to access camera/microphone. You can still use text-only chat.");
        }
      });

    return () => {
      cancelled = true;
      acquired?.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    };
  }, [prefs.mode]);

  const handleExit = () => {
    setJoined(false);
    navigate("/");
  };

  return joined ? (
    <Room prefs={prefs} localStream={localStream} onExit={handleExit} />
  ) : (
    <Lobby
      prefs={prefs}
      onPrefsChange={setPrefs}
      onJoin={() => setJoined(true)}
      localStream={localStream}
      permissionError={permissionError}
    />
  );
}
