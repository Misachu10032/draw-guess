"use client";

import Image from "next/image";
import { useState } from "react";
import type { Player } from "@/lib/players";

type RoundRevealProps = {
  player: Player;
  isLastRound: boolean;
  onNext: () => void;
};

type View = "photo" | "drawing";

export default function RoundReveal({ player, isLastRound, onNext }: RoundRevealProps) {
  const [view, setView] = useState<View>("photo");
  const src = view === "photo" ? player.photoSrc : player.drawnSrc;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-1 items-start justify-center overflow-hidden pt-1">
        <div
          className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
          style={{ width: "95%", height: "92%" }}
        >
          <div className="absolute left-2 top-2 z-10 flex gap-1.5">
            <button
              type="button"
              aria-pressed={view === "photo"}
              onClick={() => setView("photo")}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                view === "photo"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white/95 text-zinc-700"
              }`}
            >
              真人照片
            </button>
            <button
              type="button"
              aria-pressed={view === "drawing"}
              onClick={() => setView("drawing")}
              className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                view === "drawing"
                  ? "border-zinc-900 bg-zinc-900 text-white"
                  : "border-zinc-300 bg-white/95 text-zinc-700"
              }`}
            >
              我的画
            </button>
          </div>

          <Image
            key={src}
            src={src}
            alt=""
            fill
            priority
            draggable={false}
            className="pointer-events-none select-none object-contain"
          />
        </div>
      </div>

      <div
        className="flex flex-none items-center justify-center px-4 pt-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onNext}
          className="h-11 rounded-full bg-zinc-900 px-8 text-sm font-medium text-white active:scale-95"
        >
          {isLastRound ? "完成" : "下一轮"}
        </button>
      </div>
    </div>
  );
}
