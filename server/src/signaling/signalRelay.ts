import { signalSchema } from "../contracts/schemas";
import { createLogger } from "../logger";
import type { RoomService } from "../rooms/roomService";
import type { AppServer } from "../socket/types";

const log = createLogger("signaling");

/**
 * Forwards WebRTC signaling (SDP descriptions and ICE candidates) between the
 * two users of a room. The server never reads the SDP; it only checks that the
 * message is well formed and that the sender is in the room.
 */
export class SignalRelay {
  constructor(private readonly io: AppServer, private readonly rooms: RoomService) {}

  async relay(senderId: string, payload: unknown): Promise<void> {
    const parsed = signalSchema.safeParse(payload);
    if (!parsed.success) {
      log.warn(`dropping invalid signal from ${senderId}`);
      return;
    }

    const message = parsed.data;
    const receiverId = await this.rooms.roommate(message.roomId, senderId);
    if (receiverId) this.io.to(receiverId).emit("signal", message);
  }
}
