import Pusher from "pusher";

let instance: Pusher | null = null;

/** Lazily constructed so a missing env var surfaces as a clear runtime error
 *  only when a request actually needs Pusher, not at build/import time. */
export function getPusherServer(): Pusher {
  if (instance) return instance;

  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) {
    throw new Error(
      "Missing Pusher env vars. Copy .env.local.example to .env.local and fill in your Pusher app's credentials."
    );
  }

  instance = new Pusher({ appId, key, secret, cluster, useTLS: true });
  return instance;
}
