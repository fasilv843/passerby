import { z } from "zod";
import dotenv from "dotenv";

const NODE_ENV = process.env.NODE_ENV || "development";

dotenv.config({ path: `.env.${NODE_ENV}` });

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
    nodeEnv: env.data.NODE_ENV,
    port: Number(env.data.PORT),
    redisUrl: env.data.REDIS_URL,
    clientUrl: env.data.CLIENT_URL,
};
