import type { types } from "mediasoup";
import { GroupError } from "./groupError";

/**
 * One person in a group room and their mediasoup objects:
 *   transports - usually two: one to send, one to receive
 *   producers  - tracks they send (mic, camera)
 *   consumers  - tracks they receive, one per other person's track
 */
export class GroupPeer {
  readonly transports = new Map<string, types.WebRtcTransport>();
  readonly producers = new Map<string, types.Producer>();
  readonly consumers = new Map<string, types.Consumer>();

  constructor(
    readonly id: string,
    readonly displayName: string
  ) {}

  transport(transportId: string): types.WebRtcTransport {
    const transport = this.transports.get(transportId);
    if (!transport) throw new GroupError("Unknown transport");
    return transport;
  }

  producer(producerId: string): types.Producer {
    const producer = this.producers.get(producerId);
    if (!producer) throw new GroupError("Unknown producer");
    return producer;
  }

  consumer(consumerId: string): types.Consumer {
    const consumer = this.consumers.get(consumerId);
    if (!consumer) throw new GroupError("Unknown consumer");
    return consumer;
  }

  /** Closing the transports also closes every producer and consumer on them. */
  close() {
    this.transports.forEach((transport) => transport.close());
    this.transports.clear();
    this.producers.clear();
    this.consumers.clear();
  }
}
