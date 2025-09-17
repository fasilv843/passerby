import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
    PORT: z.string().regex(/^\d+$/),
    REDIS_URL: z.url(),
    CLIENT_URL: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
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
};
