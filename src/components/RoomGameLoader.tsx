"use client";

import dynamic from "next/dynamic";

// Pusher's WebSocket connection and the per-session random user id can only
// exist client-side, so this is loaded with ssr:false — there's no
// server-rendered HTML for it to mismatch against during hydration.
const RoomGame = dynamic(() => import("@/components/RoomGame"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-zinc-50" />,
});

export default function RoomGameLoader({ roomCode }: { roomCode: string }) {
  return <RoomGame roomCode={roomCode} />;
}
