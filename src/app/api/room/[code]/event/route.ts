import { NextResponse } from "next/server";
import { getPusherServer } from "@/lib/pusher-server";
import { ROOM_EVENT_NAME, roomChannelName, sanitizeRoomCode, type RoomEvent } from "@/lib/room";

const VALID_EVENT_TYPES = new Set(["stroke-batch", "clear-canvas", "chat-message", "round-advance"]);

function isRoomEvent(value: unknown): value is RoomEvent {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    typeof (value as { type: unknown }).type === "string" &&
    VALID_EVENT_TYPES.has((value as { type: string }).type)
  );
}

// Clients never trigger Pusher events directly (that needs the app secret) —
// they POST here, and this route triggers on their behalf using the server SDK.
export async function POST(request: Request, ctx: RouteContext<"/api/room/[code]/event">) {
  const { code } = await ctx.params;
  const sanitized = sanitizeRoomCode(code);
  if (!sanitized) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isRoomEvent(body)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    await getPusherServer().trigger(roomChannelName(sanitized), ROOM_EVENT_NAME, body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pusher trigger failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
