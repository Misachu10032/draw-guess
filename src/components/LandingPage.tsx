"use client";

import Link from "next/link";
import { useState } from "react";

export default function LandingPage() {
  const [roomCode, setRoomCode] = useState("");

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-10 bg-zinc-50 px-6"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
      }}
    >
      <h1 className="text-5xl font-bold tracking-tight text-zinc-900">你画我猜</h1>

      <div className="flex w-full max-w-xs flex-col gap-4">
        <Link
          href="/play"
          className="flex h-12 items-center justify-center rounded-full bg-zinc-900 text-base font-medium text-white active:scale-95"
        >
          单人模式
        </Link>

        <div className="flex items-center gap-2">
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-xs text-zinc-400">或</span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            inputMode="numeric"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="房间号"
            className="h-12 min-w-0 flex-1 rounded-full border-2 border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
          <button
            type="button"
            className="h-12 shrink-0 rounded-full border-2 border-zinc-300 bg-white px-5 text-base font-medium text-zinc-700 active:scale-95"
          >
            加入
          </button>
        </div>
      </div>
    </div>
  );
}
