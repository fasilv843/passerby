import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

/** Splits "a, b,c" into ["a", "b", "c"]. */
const csv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/** Treats an empty variable (`TURN_SECRET=`) as not set. */
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const integer = z.string().regex(/^\d+$/, "must be a whole number");

const envSchema = z.object({
  PORT: integer,
  REDIS_URL: z.url(),
  CLIENT_URL: z.url(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /** Comma-separated STUN URLs. */
  STUN_URLS: z.string().default("stun:stun.l.google.com:19302"),
  /**
   * Comma-separated TURN URLs, e.g.
   * "turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp".
   * TURN is offered to clients only when both TURN_URLS and TURN_SECRET are set.
   */
  TURN_URLS: optional(z.string()),
  /** Must match `static-auth-secret` in coturn's turnserver.conf. */
  TURN_SECRET: optional(z.string().min(16, "must be at least 16 characters")),
  /** Lifetime of generated TURN credentials, in seconds. */
  TURN_TTL: integer.default("3600"),

  /** How long a user waits at each search stage before it widens (exact → language → anyone). */
  MATCH_WIDEN_MS: integer.default("10000"),

  // ---- Group rooms (mediasoup SFU) ----
  /** Local interface the SFU listens on for media. */
  SFU_LISTEN_IP: z.string().default("0.0.0.0"),
  /**
   * Address browsers use to reach the SFU: the server's public IP or hostname.
   * The default only works when the browser runs on the same machine.
   */
  SFU_ANNOUNCED_ADDRESS: z.string().default("127.0.0.1"),
  /** UDP/TCP port range for media. Open it in the firewall. */
  SFU_MIN_PORT: integer.default("40000"),
  SFU_MAX_PORT: integer.default("40100"),
  /** mediasoup worker processes (one per CPU core is typical). */
  SFU_WORKERS: integer.default("1"),
  /** Most people allowed in one group room. */
  GROUP_MAX_PEERS: integer.default("6"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid or missing environment variables:", z.treeifyError(parsed.error).properties);
  process.exit(1);
}

const raw = parsed.data;

export const env = {
  port: Number(raw.PORT),
  redisUrl: raw.REDIS_URL,
  clientUrl: raw.CLIENT_URL,
  nodeEnv: raw.NODE_ENV,
  stunUrls: csv(raw.STUN_URLS),
  turnUrls: csv(raw.TURN_URLS),
  turnSecret: raw.TURN_SECRET,
  turnTtlSeconds: Number(raw.TURN_TTL),
  matchWidenMs: Number(raw.MATCH_WIDEN_MS),
  sfu: {
    listenIp: raw.SFU_LISTEN_IP,
    announcedAddress: raw.SFU_ANNOUNCED_ADDRESS,
    minPort: Number(raw.SFU_MIN_PORT),
    maxPort: Number(raw.SFU_MAX_PORT),
    workers: Math.max(1, Number(raw.SFU_WORKERS)),
    maxPeersPerRoom: Math.max(2, Number(raw.GROUP_MAX_PEERS)),
  },
};
