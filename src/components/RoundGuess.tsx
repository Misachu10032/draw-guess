"use client";

import Image from "next/image";
import type { Player } from "@/lib/players";

type RoundGuessProps = {
  player: Player;
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
};

export default function RoundGuess({ player, value, onChange, onConfirm }: RoundGuessProps) {
  const canConfirm = value.trim().length > 0;

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-none flex-col items-center gap-2 px-4 pb-3 pt-1">
        <div className="flex w-full max-w-xs items-center gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canConfirm) onConfirm();
            }}
            placeholder="这是谁？"
            className="h-11 min-w-0 flex-1 rounded-full border-2 border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onConfirm}
            className="h-11 shrink-0 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white active:scale-95 disabled:opacity-40"
          >
            确认
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-hidden">
        <div
          className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
          style={{ width: "95%", height: "92%" }}
        >
          <Image
            src={player.drawnSrc}
            alt=""
            fill
            priority
            draggable={false}
            className="pointer-events-none select-none object-contain"
          />
        </div>
      </div>
    </div>
  );
}
