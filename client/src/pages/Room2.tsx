// import { useCallback, useEffect, useRef, useState } from "react";
// import Loading from "../components/Loading";
// import { Socket } from "socket.io-client";
// import peerService from "../services/peerService";
// import { useSocket } from "../hooks/socket";

// export default function Room() {
//   //* socket value will not be null since provider handles it
//   const socket = useSocket() as Socket;

//   const [localStream, setLocalStream] = useState<MediaStream | null>(null);
//   const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
//   const localStreamRef = useRef<MediaStream | null>(null);
//   const remoteStreamRef = useRef<MediaStream | null>(null);
//   const localVideoRef = useRef<HTMLVideoElement>(null);
//   const remoteVideoRef = useRef<HTMLVideoElement>(null);
//   const [isAudioMuted, setIsAudioMuted] = useState(false);
//   const [isVideoMuted, setIsVideoMuted] = useState(false);

//   useEffect(() => {
//     const getCam = async () => {
//       const stream = await window.navigator.mediaDevices.getUserMedia({
//         video: true,
//         audio: true,
//       });

//       console.log("set localStream");

//       setLocalStream(stream);
//       localStreamRef.current = stream;

//       if (!localVideoRef.current) {
//         return;
//       }

//       localVideoRef.current.srcObject = stream;
//       localVideoRef.current.play();
//     };
//     getCam();

//     return () => {
//       localStreamRef.current?.getTracks().forEach((t) => t.stop());
//       remoteStreamRef.current?.getTracks().forEach((t) => t.stop());
//     };
//   }, []);

//   useEffect(() => {
//     console.log("remoteStream changed", remoteStream);
//     console.log("current remoteVideoRef", remoteVideoRef.current);

//     if (remoteVideoRef.current && remoteStream) {
//       remoteVideoRef.current.srcObject = remoteStream;
//       remoteStreamRef.current = remoteStream;
//     }
//   }, [remoteStream]);

//   const setTracks = useCallback(() => {
//     console.log(localStreamRef.current, "localStreamRef");
//     if (localStreamRef?.current) {
//       localStreamRef.current.getTracks().forEach((track) => {
//         console.warn(track, track.kind);
//         peerService.peer.addTrack(track, localStreamRef.current as MediaStream);
//       });
//     }
//   }, [localStreamRef]);

//   const handleSendOffer = useCallback(
//     ({ roomId }: { roomId: string }) => {
//       console.log("send-offer received - roomId", roomId);

//       setTracks();

//       peerService.peer.onicecandidate = async (e) => {
//         console.log("receiving ice candidate locally");

//         if (e.candidate) {
//           socket.emit("add-ice-candidate", {
//             candidate: e.candidate,
//             type: "sender",
//             roomId,
//           });
//         }
//       };

//       peerService.peer.onnegotiationneeded = async () => {
//         console.log("on negotiation needed, generating offer", "in send-offer");
//         const offer = await peerService.getOffer();
//         console.log("offer", offer);
//         socket.emit("offer", {
//           offer,
//           roomId,
//         });
//       };

//       peerService.peer.ontrack = (event) => {
//         console.error("Remote track received:", event, "send-offer");

//         const stream = event.streams[0];
//         setRemoteStream(stream);
//         // remoteStreamRef.current = stream;
//       };
//     },
//     [socket, setTracks]
//   );

//   const handleOffer = useCallback(
//     async ({ roomId, offer }: {
//         roomId: string;
//         offer: RTCSessionDescriptionInit;
//       }) => {
//         console.log("received offer", offer);

//         setTracks()

//         const answer = await peerService.getAnswer(offer);
//         console.log("sending answer", answer);
//         socket.emit("answer", { roomId, answer });

//         peerService.peer.ontrack = (event) => {
//           console.error("Remote track received:", event, "offer");

//           const stream = event.streams[0];
//           setRemoteStream(stream);
//         };

//         peerService.peer.onicecandidate = async (e) => {
//           if (!e.candidate) {
//             return;
//           }
//           // console.log("omn ice candidate on receiving side ...", e.candidate);
//           if (e.candidate) {
//             socket.emit("add-ice-candidate", {
//               candidate: e.candidate,
//               type: "receiver",
//               roomId,
//             });
//           }
//         };

//         peerService.peer.onnegotiationneeded = async () => {
//           console.log("on negotiation needed, generating offer", "in offer");
//           // localStreamRef.current.getTracks().forEach(track => peerService.peer.addTrack(track, localStreamRef.current));
//           const offer = await peerService.getOffer();
//           console.log("offer", offer);
//           socket.emit("offer", {
//             offer,
//             roomId,
//           });
//         };
//       },
//     [socket, setTracks]
//   );

//     const handleAnswer = useCallback(
//         ({
//             roomId,
//             answer,
//         }: {
//             roomId: string;
//             answer: RTCSessionDescriptionInit;
//         }) => {
//             // setLobby(false);
//             console.log("received answer", answer);
//             peerService.setLocalDescription(answer);
//             console.log("loop closed");
//     }, [])

//     const handleAddIceCandidate = useCallback(({ candidate, type }) => {
//         console.log("add ice candidate from remote");
//         // console.log({candidate, type})
//         peerService.peer.addIceCandidate(candidate);
//     }, [])

//   useEffect(() => {
//     socket.on("send-offer", handleSendOffer);
//     socket.on("add-ice-candidate", handleAddIceCandidate);
//     socket.on("offer", handleOffer);
//     socket.on("answer", handleAnswer);

//     return () => {
//         socket.off("send-offer", handleSendOffer);
//         socket.off("add-ice-candidate", handleAddIceCandidate);
//         socket.off("offer", handleOffer);
//         socket.off("answer", handleAnswer);
//     };
//   }, [socket, handleSendOffer, handleAddIceCandidate, handleOffer, handleAnswer]);

//   const toggleAudio = () => {
//     const enabled = !isAudioMuted;
//     setIsAudioMuted(enabled);
//     localStreamRef.current
//       ?.getAudioTracks()
//       .forEach((t) => (t.enabled = !enabled));
//   };

//   const toggleVideo = () => {
//     const enabled = !isVideoMuted;
//     setIsVideoMuted(enabled);
//     localStreamRef.current
//       ?.getVideoTracks()
//       .forEach((t) => (t.enabled = !enabled));
//   };

//   const handlePass = () => {
//     // Placeholder: would signal server to skip
//     // remoteStream?.getTracks().forEach((t) => t.stop());
//     setRemoteStream(null);
//     remoteStreamRef.current = null;
//     // In a real flow, re-match here
//   };

//   return (
//     // <div className="min-h-screen flex flex-col">
//     <>
//       <main className="flex-1">
//         <div className="max-w-6xl mx-auto px-4 py-6 grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-2">
//           <div className="aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
//             {localStream ? (
//               <video
//                 ref={localVideoRef}
//                 autoPlay
//                 playsInline
//                 muted
//                 className="w-full h-full object-cover"
//               />
//             ) : (
//               <Loading />
//             )}
//           </div>
//           <div className="aspect-video w-full bg-black/5 rounded-lg overflow-hidden border flex items-center justify-center">
//             {remoteStream ? (
//               <video
//                 ref={remoteVideoRef}
//                 autoPlay
//                 playsInline
//                 className="w-full h-full object-cover"
//               />
//             ) : (
//               <Loading />
//             )}
//           </div>
//         </div>
//       </main>

//       <div className="sticky bottom-0 border-t bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
//         <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-center gap-3">
//           <button className="btn btn-ghost" onClick={toggleAudio}>
//             <span className="icon">{isAudioMuted ? "mic_off" : "mic"}</span>
//             {isAudioMuted ? "Unmute" : "Mute"}
//           </button>
//           <button className="btn btn-ghost" onClick={toggleVideo}>
//             <span className="icon">
//               {isVideoMuted ? "videocam_off" : "videocam"}
//             </span>
//             {isVideoMuted ? "Start Video" : "Stop Video"}
//           </button>
//           <button className="btn btn-primary" onClick={handlePass}>
//             <span className="icon">skip_next</span>
//             Pass
//           </button>
//         </div>
//       </div>
//     </>

//     // </div>
//   );
// }
