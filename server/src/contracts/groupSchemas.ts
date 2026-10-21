/**
 * Runtime validation for group-room requests. mediasoup's own objects
 * (RTP parameters, DTLS parameters, capabilities) are only checked for shape
 * here; mediasoup validates their contents and throws on anything invalid.
 */
import { z } from "zod";

export const roomIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,16}$/, "invalid room id");
const id = z.string().min(1).max(64);
const mediasoupObject = z.looseObject({});

export const groupSchemas = {
  /** For requests without a payload. */
  none: z.undefined(),
  join: z.object({
    roomId: roomIdSchema,
    displayName: z.string().trim().min(1).max(30),
  }),
  createTransport: z.object({ direction: z.enum(["send", "recv"]) }),
  connectTransport: z.object({ transportId: id, dtlsParameters: mediasoupObject }),
  produce: z.object({ transportId: id, kind: z.enum(["audio", "video"]), rtpParameters: mediasoupObject }),
  setProducerPaused: z.object({ producerId: id, paused: z.boolean() }),
  consume: z.object({ transportId: id, producerId: id, rtpCapabilities: mediasoupObject }),
  resumeConsumer: z.object({ consumerId: id }),
  setPreferredLayer: z.object({ consumerId: id, spatialLayer: z.number().int().min(0).max(2) }),
};
