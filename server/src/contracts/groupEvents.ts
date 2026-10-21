/**
 * Socket.IO contract for group rooms, on the "/group" namespace.
 * The client keeps a copy in client/src/types/group.ts; change both together.
 *
 * Client requests use acknowledgements (request/response), because each
 * mediasoup step needs the server's answer before the next one.
 */
import type { types } from "mediasoup";
import type { IceServer } from "./events";

export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };
export type Ack<T> = (response: AckResponse<T>) => void;

export type MediaKind = "audio" | "video";
export type TransportDirection = "send" | "recv";

export interface PeerInfo {
  peerId: string;
  displayName: string;
}

export interface ProducerInfo {
  producerId: string;
  peerId: string;
  kind: MediaKind;
  paused: boolean;
}

export interface JoinResult {
  selfId: string;
  routerRtpCapabilities: types.RtpCapabilities;
  /** Everyone already in the room. */
  peers: PeerInfo[];
  /** Tracks they're already sending. */
  producers: ProducerInfo[];
  /** TURN, for networks that block direct UDP to the SFU. */
  iceServers: IceServer[];
}

export interface TransportParams {
  id: string;
  iceParameters: types.IceParameters;
  iceCandidates: types.IceCandidate[];
  dtlsParameters: types.DtlsParameters;
}

export interface ConsumerParams {
  consumerId: string;
  producerId: string;
  peerId: string;
  kind: MediaKind;
  rtpParameters: types.RtpParameters;
  /** Whether the sender has paused this track (camera or mic off). */
  producerPaused: boolean;
}

export interface GroupClientToServerEvents {
  createRoom: (ack: Ack<{ roomId: string }>) => void;
  join: (payload: { roomId: string; displayName: string }, ack: Ack<JoinResult>) => void;
  createTransport: (payload: { direction: TransportDirection }, ack: Ack<TransportParams>) => void;
  connectTransport: (payload: { transportId: string; dtlsParameters: types.DtlsParameters }, ack: Ack<null>) => void;
  produce: (
    payload: { transportId: string; kind: MediaKind; rtpParameters: types.RtpParameters },
    ack: Ack<{ producerId: string }>
  ) => void;
  setProducerPaused: (payload: { producerId: string; paused: boolean }, ack: Ack<null>) => void;
  consume: (
    payload: { transportId: string; producerId: string; rtpCapabilities: types.RtpCapabilities },
    ack: Ack<ConsumerParams>
  ) => void;
  resumeConsumer: (payload: { consumerId: string }, ack: Ack<null>) => void;
  /** Ask for a simulcast layer: 0 = lowest quality, 2 = highest. The SFU may go lower if bandwidth is short. */
  setPreferredLayer: (payload: { consumerId: string; spatialLayer: number }, ack: Ack<null>) => void;
  leave: (ack: Ack<null>) => void;
}

export interface GroupServerToClientEvents {
  peerJoined: (peer: PeerInfo) => void;
  peerLeft: (payload: { peerId: string }) => void;
  newProducer: (producer: ProducerInfo) => void;
  producerPaused: (payload: { producerId: string; paused: boolean }) => void;
  /** One of this client's consumers closed, usually because its sender left. */
  consumerClosed: (payload: { consumerId: string }) => void;
}

export interface GroupSocketData {
  /** Set once the socket has joined a room. */
  roomId?: string;
}
