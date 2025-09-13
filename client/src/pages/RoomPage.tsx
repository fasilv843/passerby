import { useEffect, useState } from "react";
import Lobby from "./Lobby";
import Room from "./Room";

export default function RoomPage() {
  const [joined, setJoined] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);


  useEffect(() => {
    const getPermissions = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        setLocalStream(stream);

        // if (localVideoRef.current) {
        //   localVideoRef.current.srcObject = stream;
        //   localVideoRef.current.play();
        // }
      } catch (err: any) {
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
  }, []);

  const handleJoin = () => {
    setJoined(true);
    // setup socket + peer connection here
  };

  const handleExit = () => {
    setJoined(false);
    localStream?.getTracks().forEach((t) => t.stop());
    // remoteStream?.getTracks().forEach((t) => t.stop());
    setLocalStream(null);
    // setRemoteStream(null);
  };

  return joined ? (
    <Room
      localStream={localStream}
    //   remoteStream={remoteStream}
    //   onPass={() => setRemoteStream(null)}
      onExit={handleExit}
    />
  ) : (
    <Lobby onJoin={handleJoin} localStream={localStream} permissionError={permissionError} />
  );
}
