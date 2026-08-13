"use client";

import Image from "next/image";
import { useState, type ReactNode } from "react";
import type { Player } from "@/lib/players";

type RoundReviewPanelProps = {
  entries: readonly Player[];
  /** The guess the user typed for each round (by index), shown on the "画"
   *  button instead of the real player name. */
  guesses: readonly (string | null)[];
  /** How many entries (from the start) have their round's guess confirmed —
   *  both the drawn picture and the real photo unlock together, so neither
   *  row gives away a round's name before it's been guessed. */
  unlockedCount: number;
  /** Overrides the "画" row's full-screen preview for a given round index —
   *  e.g. replaying the actual live-drawn strokes in multiplayer, instead of
   *  the default static reference image. */
  renderDrawing?: (index: number) => ReactNode;
};

type ModalContent = { kind: "image"; src: string; alt: string } | { kind: "custom"; node: ReactNode };

export default function RoundReviewPanel({ entries, guesses, unlockedCount, renderDrawing }: RoundReviewPanelProps) {
  const [modal, setModal] = useState<ModalContent | null>(null);

  return (
    <>
      <div className="flex flex-col gap-1.5 rounded-2xl border border-zinc-200 bg-white/95 p-2 shadow-sm backdrop-blur">
        <ReviewRow
          label="画"
          entries={entries}
          unlockedCount={unlockedCount}
          getDisplayName={(entry, i) => guesses[i] ?? entry.name}
          onSelect={(entry, i) =>
            setModal(
              renderDrawing
                ? { kind: "custom", node: renderDrawing(i) }
                : { kind: "image", src: entry.drawnSrc, alt: entry.name }
            )
          }
        />
        <ReviewRow
          label="真人照片"
          entries={entries}
          unlockedCount={unlockedCount}
          getDisplayName={(entry) => entry.name}
          onSelect={(entry) => setModal({ kind: "image", src: entry.photoSrc, alt: entry.name })}
        />
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setModal(null)}
        >
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setModal(null)}
            className="absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg active:scale-95"
            style={{ top: "max(1rem, env(safe-area-inset-top))", right: "1rem" }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <div className="relative h-full w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            {modal.kind === "image" ? (
              <Image src={modal.src} alt={modal.alt} fill className="object-contain" />
            ) : (
              modal.node
            )}
          </div>
        </div>
      )}
    </>
  );
}

type ReviewRowProps = {
  label: string;
  entries: readonly Player[];
  unlockedCount: number;
  getDisplayName: (entry: Player, index: number) => string;
  onSelect: (entry: Player, index: number) => void;
};

function ReviewRow({ label, entries, unlockedCount, getDisplayName, onSelect }: ReviewRowProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-12 shrink-0 text-[10px] font-medium text-zinc-400">{label}</span>
      <div className="grid flex-1 grid-cols-6 gap-1">
        {entries.map((entry, i) => {
          const unlocked = i < unlockedCount;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={!unlocked}
              aria-label={unlocked ? `${label} ${getDisplayName(entry, i)}` : `${label} 未解锁`}
              onClick={() => onSelect(entry, i)}
              className={`flex h-6 items-center justify-center overflow-hidden rounded-full border px-0.5 text-[10px] font-medium transition-colors active:scale-95 ${
                unlocked ? "border-zinc-300 bg-white text-zinc-700" : "border-zinc-200 bg-zinc-100 text-zinc-300"
              }`}
            >
              {unlocked ? (
                <span className="truncate">{getDisplayName(entry, i)}</span>
              ) : (
                <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <rect x="5" y="11" width="14" height="9" rx="1.5" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
