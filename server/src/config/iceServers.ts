import { createHmac } from "crypto";
import { env } from "./env";
import type { IceServer } from "../contracts/events";

export interface IceConfig {
  stunUrls: string[];
  turnUrls: string[];
  turnSecret?: string;
  turnTtlSeconds: number;
}

/**
 * Builds the ICE server list for one user.
 *
 * TURN credentials follow coturn's "TURN REST API" scheme (use-auth-secret):
 *   username   = "<unix expiry>:<user id>"
 *   credential = base64(HMAC-SHA1(static-auth-secret, username))
 * coturn recomputes the HMAC and rejects the credential after the expiry,
 * so no per-user state is stored and leaked credentials stop working on their own.
 */
export function buildIceServers(userId: string, config: IceConfig, nowMs = Date.now()): IceServer[] {
  const servers: IceServer[] = [];

  if (config.stunUrls.length) {
    servers.push({ urls: config.stunUrls });
  }

  if (config.turnSecret && config.turnUrls.length) {
    const expiry = Math.floor(nowMs / 1000) + config.turnTtlSeconds;
    const username = `${expiry}:${userId}`;
    const credential = createHmac("sha1", config.turnSecret).update(username).digest("base64");
    servers.push({ urls: config.turnUrls, username, credential });
  }

  return servers;
}

/** ICE servers for a user, using the server's environment configuration. */
export const getIceServers = (userId: string) => buildIceServers(userId, env);
