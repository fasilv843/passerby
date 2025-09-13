import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Loading from "../components/Loading";

interface LobbyProps {
  onJoin: () => void;
  localStream: MediaStream | null;
  permissionError: string | null;
}

export default function Lobby({ onJoin, permissionError, localStream }: LobbyProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);

//     const getPermissions = async () => {
//       try {
//         const stream = await navigator.mediaDevices.getUserMedia({
//           video: true,
//           audio: true,
//         });
//         if (localVideoRef.current) {
//           localVideoRef.current.srcObject = stream;
//           localVideoRef.current.play();
//         }
//       } catch (err: any) {
//         if (err.name === "NotAllowedError") {
//           setPermissionError("Camera and microphone permission required");
//         } else if (err.name === "NotFoundError") {
//           setPermissionError("Camera or microphone not found");
//         } else {
//           setPermissionError("Unable to access camera/microphone");
//         }
//       }
//     };
//     getPermissions();
//   }, []);
    useEffect(() => {
        if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play();
        }
    }, [localStream])
  return (
    <>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
          <div className="aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
            {permissionError ? (
              <p className="text-red-500">{permissionError}</p>
            ) : (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <div className="aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
            <p>Join to Talk</p>
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <Link to="/" className="btn btn-primary">
            Go Back
          </Link>
          <button
            className="btn btn-primary"
            onClick={onJoin}
            disabled={!!permissionError}
          >
            Join
          </button>
        </div>
      </div>
    </>
  );
}
  