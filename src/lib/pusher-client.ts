import Pusher from "pusher-js";

/** One instance per room session; the caller owns its lifecycle (disconnect on unmount). */
export function createPusherClient(userId: string): Pusher {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY;
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER;

  if (!key || !cluster) {
    throw new Error("Missing NEXT_PUBLIC_PUSHER_KEY / NEXT_PUBLIC_PUSHER_CLUSTER env vars.");
  }

  return new Pusher(key, {
    cluster,
    channelAuthorization: {
      transport: "ajax",
      endpoint: "/api/pusher/auth",
      params: { user_id: userId },
    },
  });
}
