import { useCallback, useEffect, useRef, useState } from "react";
import Loading from "../components/Loading";
import { io } from "socket.io-client";
import peerService from "../services/peerService";

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

  const setTracks = useCallback(() => {
    console.log(localStream, 'localStream');
    if (localStream) {
        localStream.getTracks().forEach(track => {
            console.warn(track, track.kind);
            peerService.peer.addTrack(track, localStream);
        });
    }
  }, [localStream])

  const handleOnTrack = useCallback((event: RTCTrackEvent) => {
    console.error("Remote track received:", event);

    const stream = event.streams[0];
    setRemoteStream(stream);
  }, [])

  peerService.peer.ontrack = handleOnTrack;

  useEffect(() => {
    const socket = io("http://localhost:3000");
    socket.on("send-offer", ({ roomId }: { roomId: string }) => {
        console.log('send-offer received - roomId', roomId);

        setTracks()

        peerService.peer.onicecandidate = async (e) => {
            console.log("receiving ice candidate locally");
            // console.log(e.candidate, 'e.candidate');
            
            if (e.candidate) {
               socket.emit("add-ice-candidate", {
                candidate: e.candidate,
                type: "sender",
                roomId
               })
            }
        }

        peerService.peer.onnegotiationneeded = async () => {
            console.log("on negotiation needed, generating offer", 'in send-offer');
            const offer = await peerService.getOffer();
            console.log("offer", offer);
            socket.emit("offer", {
                offer,
                roomId
            })
        }
        
    })

    socket.on("add-ice-candidate", ({candidate, type}) => {
        console.log("add ice candidate from remote");
        // console.log({candidate, type})
        peerService.peer.addIceCandidate(candidate);
    })

    socket.on("offer", async ({roomId, offer}: { roomId: string, offer: RTCSessionDescriptionInit }) => {
        console.log("received offer", offer);

        setTracks()

        const answer = await peerService.getAnswer(offer)
        console.log("sending answer", answer);
        socket.emit('answer', { roomId, answer })

        peerService.peer.onicecandidate = async (e) => {
            if (!e.candidate) {
                return;
            }
            // console.log("omn ice candidate on receiving side ...", e.candidate);
            if (e.candidate) {
               socket.emit("add-ice-candidate", {
                candidate: e.candidate,
                type: "receiver",
                roomId
               })
            }
        }

        peerService.peer.onnegotiationneeded = async () => {
            console.log("on negotiation needed, generating offer", 'in offer');
            const offer = await peerService.getOffer();
            console.log("offer", offer);
            socket.emit("offer", {
                offer,
                roomId
            })
        }

    })

    socket.on("answer", ({roomId, answer}: { roomId: string, answer: RTCSessionDescriptionInit }) => {
        console.log('received answer', answer);
        peerService.setLocalDescription(answer)
        console.log("loop closed");
    })

    return () => {
        socket.disconnect()
    }
  }, [])

  const handlePass = () => {
    // onPass();
    setRemoteStream(null);
  };

  const handleExit = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
        setRemoteStream(null);
    }

    if (peerService.peer) {
        peerService.peer.close();
        // peerService.peer = null; // if you keep it in a singleton/service
    }

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
