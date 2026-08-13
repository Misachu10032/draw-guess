"use client";

import Link from "next/link";
import { useState } from "react";
import { PLAYERS } from "@/lib/players";
import RoundGuess from "@/components/RoundGuess";
import RoundReveal from "@/components/RoundReveal";
import RoundReviewPanel from "@/components/RoundReviewPanel";

type Phase = "guess" | "reveal";

const TOTAL_ROUNDS = PLAYERS.length;

export default function PlayGame() {
  const [roundIndex, setRoundIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("guess");
  const [guessInput, setGuessInput] = useState("");
  const [finished, setFinished] = useState(false);

  const player = PLAYERS[roundIndex];
  const isLastRound = roundIndex === TOTAL_ROUNDS - 1;

  // A round only unlocks in the review panel once it's fully over (i.e. once
  // you've moved past it) — not merely once you've confirmed your guess.
  const unlockedCount = finished ? TOTAL_ROUNDS : roundIndex;

  const handleConfirm = () => {
    setPhase("reveal");
  };

  const handleNext = () => {
    if (isLastRound) {
      setFinished(true);
      return;
    }
    setRoundIndex((i) => i + 1);
    setGuessInput("");
    setPhase("guess");
  };

  return (
    <div className="flex h-full w-full flex-col bg-zinc-50">
      <div className="flex-none px-3 pb-1.5" style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}>
        <RoundReviewPanel entries={PLAYERS} unlockedCount={unlockedCount} />
        <p className="mt-1.5 text-center text-xs font-medium text-zinc-400">
          {finished ? "已完成" : `第 ${roundIndex + 1} / ${TOTAL_ROUNDS} 轮`}
        </p>
      </div>

      <div className="min-h-0 flex-1">
        {finished ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-6 text-center">
            <p className="text-2xl font-bold text-zinc-900">你完成了全部 {TOTAL_ROUNDS} 轮！</p>
            <Link
              href="/"
              className="flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white active:scale-95"
            >
              返回首页
            </Link>
          </div>
        ) : phase === "guess" ? (
          <RoundGuess player={player} value={guessInput} onChange={setGuessInput} onConfirm={handleConfirm} />
        ) : (
          <RoundReveal key={player.id} player={player} isLastRound={isLastRound} onNext={handleNext} />
        )}
      </div>
    </div>
  );
}
