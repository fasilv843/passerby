import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const csv = (value: string | undefined) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const envSchema = z.object({
    PORT: z.string().regex(/^\d+$/),
    REDIS_URL: z.url(),
    CLIENT_URL: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    // Comma-separated STUN URLs. Defaults to public STUN servers.
    STUN_URLS: z.string().default("stun:stun.l.google.com:19302"),
    // Comma-separated TURN URLs, e.g. "turn:turn.example.com:3478?transport=udp,turns:turn.example.com:5349?transport=tcp".
    // TURN is only offered to clients when both TURN_URLS and TURN_SECRET are set.
    TURN_URLS: z.string().optional(),
    // Must match `static-auth-secret` in coturn's turnserver.conf.
    TURN_SECRET: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(16).optional()),
    // Lifetime of generated TURN credentials, in seconds.
    TURN_TTL: z.string().regex(/^\d+$/).default("3600"),
    // How long a user waits at each search stage before it widens (exact → language → anyone).
    MATCH_WIDEN_MS: z.string().regex(/^\d+$/).default("10000"),
});


const env = envSchema.safeParse(process.env);


if (!env.success) {
  console.error("❌ Invalid or missing environment variables:", z.treeifyError(env.error).properties);
  process.exit(1);
}

export const envConfig = {
    port: Number(env.data.PORT),
    redisUrl: env.data.REDIS_URL,
    clientUrl: env.data.CLIENT_URL,
    nodeEnv: env.data.NODE_ENV,
    stunUrls: csv(env.data.STUN_URLS),
    turnUrls: csv(env.data.TURN_URLS),
    turnSecret: env.data.TURN_SECRET,
    turnTtl: Number(env.data.TURN_TTL),
    matchWidenMs: Number(env.data.MATCH_WIDEN_MS),
};
