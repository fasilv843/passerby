import { createHmac } from "crypto";
import { envConfig } from "./environments";
import { IceServer } from "../types";

/**
 * Builds the ICE server list for one user.
 *
 * TURN credentials follow coturn's "TURN REST API" scheme (use-auth-secret):
 *   username   = "<unix expiry>:<user id>"
 *   credential = base64(HMAC-SHA1(static-auth-secret, username))
 * coturn recomputes the HMAC and rejects the credential after the expiry,
 * so no per-user state is stored and leaked credentials stop working on their own.
 */
export function getIceServers(userId: string): IceServer[] {
  const servers: IceServer[] = [];

  if (envConfig.stunUrls.length) {
    servers.push({ urls: envConfig.stunUrls });
  }

  if (envConfig.turnSecret && envConfig.turnUrls.length) {
    const expiry = Math.floor(Date.now() / 1000) + envConfig.turnTtl;
    const username = `${expiry}:${userId}`;
    const credential = createHmac("sha1", envConfig.turnSecret)
      .update(username)
      .digest("base64");

    servers.push({ urls: envConfig.turnUrls, username, credential });
  }

  return servers;
}
