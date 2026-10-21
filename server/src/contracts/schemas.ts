/**
 * Runtime validation for everything a client sends. Types alone don't protect
 * the server: any client can emit any payload.
 */
import { z } from "zod";

export const signalSchema = z
  .object({
    roomId: z.string().min(1),
    description: z
      .object({
        type: z.enum(["offer", "answer", "pranswer", "rollback"]),
        sdp: z.string().max(100_000).optional(),
      })
      .optional(),
    candidate: z
      .object({
        candidate: z.string().max(1_000),
        sdpMid: z.string().nullable().optional(),
        sdpMLineIndex: z.number().nullable().optional(),
        usernameFragment: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .refine((msg) => msg.description || msg.candidate, "a signal needs a description or a candidate");

export const passSchema = z.object({ roomId: z.string().min(1) });
