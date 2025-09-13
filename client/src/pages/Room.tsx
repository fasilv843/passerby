import { useCallback, useEffect, useRef, useState } from "react";
import Loading from "../components/Loading";
import peerService from "../services/peerService";
import socketService from "../services/socketService";

interface RoomProps {
  localStream: MediaStream | null;
  onExit: () => void;
}

export default function Room({
  localStream,
  onExit,
}: RoomProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null)

  useEffect(() => {
    socketService.connect();

    return () => {
        socketService.disconnect();
    }
  }, [])


  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play();
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play();
    }
  }, [remoteStream]);

  const handleOnTrack = useCallback((event: RTCTrackEvent) => {
    console.warn("Remote track received:", event);
    const stream = event.streams[0];
    setRemoteStream(stream);
  }, [])

  const handleOnIceCandidate = useCallback((e: RTCPeerConnectionIceEvent) => {
    console.log("receiving ice candidate locally");
    
    const socket = socketService.getSocket()
    
    if (e.candidate) {
       socket.emit("add-ice-candidate", {
        candidate: e.candidate,
        type: "sender",
        roomId
       })
    }
  }, [roomId])

  const handleOnNegoNeeded = useCallback(async () => {
    console.log("on negotiation needed, generating offer", 'in handleOnNegoNeeded');
    
    const offer = await peerService.getOffer();
    const socket = socketService.getSocket();
    console.log("offer", offer);
    socket.emit("offer", {
        offer,
        roomId
    })
  }, [roomId])

  useEffect(() => {
    peerService.create(
        handleOnTrack,
        handleOnIceCandidate,
        handleOnNegoNeeded
    );
    return () => {
      peerService.close();
    }
  }, [handleOnTrack, handleOnIceCandidate, handleOnNegoNeeded])

  const setTracks = useCallback(() => {
    if (localStream) {
        peerService.addTracks(localStream);
    }
  }, [localStream])



  useEffect(() => {
    const socket = socketService.getSocket()

    socket.on("send-offer", ({ roomId }: { roomId: string }) => {
        console.log('send-offer received - roomId', roomId);
        setRoomId(roomId);
        setTracks()
    })

    socket.on("add-ice-candidate", ({ candidate }) => {
        console.log("add ice candidate from remote");
        peerService.addIceCandidate(candidate);
    })

    socket.on("offer", async ({roomId, offer}: { roomId: string, offer: RTCSessionDescriptionInit }) => {
        console.log("offer received ");
        setRoomId(roomId)

        setTracks()

        const answer = await peerService.getAnswer(offer)
        console.log("sending answer");
        socket.emit('answer', { roomId, answer })

    })

    socket.on("answer", ({ answer }: { answer: RTCSessionDescriptionInit }) => {
        console.log('answer received');
        peerService.setLocalDescription(answer)
        console.log("loop closed");
    })

    return () => {
        // socket.disconnect()
    }
  }, [])

  const handlePass = () => {
    setRemoteStream(null);
    peerService.reset(
        handleOnTrack,
        handleOnIceCandidate,
        handleOnNegoNeeded
    );
  };

  const handleExit = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        setRemoteStream(null);
    }

    peerService.close()

    // socket.emit("leave-room", { roomId });

    onExit()
  };

  return (
    <>
      <main className="flex-1">
        <div className="max-w-6xl mx-auto px-4 py-6 grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
          <div className="aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
            {localStream ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <Loading />
            )}
          </div>
          <div className="aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
            {remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <Loading />
            )}
          </div>
        </div>
      </main>

      <div className="sticky bottom-0 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
          <button className="btn btn-primary" onClick={handlePass}>
            Pass
          </button>
          <button className="btn btn-primary" onClick={handleExit}>
            Exit
          </button>
        </div>
      </div>
    </>
  );
}
