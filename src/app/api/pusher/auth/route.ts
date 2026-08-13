import { NextResponse } from "next/server";
import { getPusherServer } from "@/lib/pusher-server";

// pusher-js's "ajax" auth transport POSTs socket_id/channel_name (plus any
// configured extra params, e.g. user_id) as a urlencoded body — see
// createPusherClient in src/lib/pusher-client.ts for the params it sends.
export async function POST(request: Request) {
  const body = await request.text();
  const params = new URLSearchParams(body);

  const socketId = params.get("socket_id");
  const channelName = params.get("channel_name");
  const userId = params.get("user_id");

  if (!socketId || !channelName || !userId) {
    return NextResponse.json({ error: "Missing socket_id, channel_name, or user_id" }, { status: 400 });
  }

  if (!channelName.startsWith("presence-room-")) {
    return NextResponse.json({ error: "Unknown channel" }, { status: 403 });
  }

  try {
    const authResponse = getPusherServer().authorizeChannel(socketId, channelName, {
      user_id: userId,
    });
    return NextResponse.json(authResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pusher auth failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
