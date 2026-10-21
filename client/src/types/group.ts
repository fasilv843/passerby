/**
 * Socket.IO contract for group rooms (the "/group" namespace).
 * Mirrors server/src/contracts/groupEvents.ts; change both together.
 */
import type { types } from "mediasoup-client";

export type AckResponse<T> = { ok: true; data: T } | { ok: false; error: string };

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
  peers: PeerInfo[];
  producers: ProducerInfo[];
  iceServers: RTCIceServer[];
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
  producerPaused: boolean;
}

/** Requests and what each one answers with. */
export interface GroupRequests {
  createRoom: { payload: undefined; result: { roomId: string } };
  join: { payload: { roomId: string; displayName: string }; result: JoinResult };
  createTransport: { payload: { direction: TransportDirection }; result: TransportParams };
  connectTransport: { payload: { transportId: string; dtlsParameters: types.DtlsParameters }; result: null };
  produce: {
    payload: { transportId: string; kind: MediaKind; rtpParameters: types.RtpParameters };
    result: { producerId: string };
  };
  setProducerPaused: { payload: { producerId: string; paused: boolean }; result: null };
  consume: {
    payload: { transportId: string; producerId: string; rtpCapabilities: types.RtpCapabilities };
    result: ConsumerParams;
  };
  resumeConsumer: { payload: { consumerId: string }; result: null };
  setPreferredLayer: { payload: { consumerId: string; spatialLayer: number }; result: null };
  leave: { payload: undefined; result: null };
}

export interface GroupServerEvents {
  peerJoined: (peer: PeerInfo) => void;
  peerLeft: (payload: { peerId: string }) => void;
  newProducer: (producer: ProducerInfo) => void;
  producerPaused: (payload: { producerId: string; paused: boolean }) => void;
  consumerClosed: (payload: { consumerId: string }) => void;
}
