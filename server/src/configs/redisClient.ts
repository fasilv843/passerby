import Redis from "ioredis";
import { envConfig } from "./environments";

export const redis = new Redis(envConfig.redisUrl);
