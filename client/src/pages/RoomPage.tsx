import { useEffect, useState } from "react";
import Lobby from "./Lobby";
import Room from "./Room";
import { useNavigate } from "react-router-dom";

export default function RoomPage() {
  const [joined, setJoined] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
    const navigate = useNavigate()

  useEffect(() => {
    const getPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setLocalStream(stream);
      } catch (err: any) {
        console.warn(err, 'permission error');
        if (err.name === "NotAllowedError") {
          setPermissionError("Camera and microphone permission required");
        } else if (err.name === "NotFoundError") {
          setPermissionError("Camera or microphone not found");
        } else {
          setPermissionError("Unable to access camera/microphone");
        }
      }
    };
    getPermissions();

    return () => {
      console.log('cleaning up, local stream from RoomPage');
      
      localStream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const handleJoin = () => {
    setJoined(true);
    // setup socket + peer connection here
  };

  const handleExit = () => {
    setJoined(false);
    localStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    navigate('/');
  };

  return joined ? (
    <Room
      localStream={localStream}
      onExit={handleExit}
    />
  ) : (
    <Lobby onJoin={handleJoin} localStream={localStream} permissionError={permissionError} />
  );
}
