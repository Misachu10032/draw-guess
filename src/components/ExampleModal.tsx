"use client";

import Image from "next/image";
import { useState } from "react";

// lizhongwei is deliberately excluded from src/lib/players.ts (never used in
// actual rounds), which makes these safe as illustrative examples — showing
// them can never spoil a real game.
// title is blank for now — fill these in later; falls back to "示例 N" until then.
const EXAMPLES = [
  { title: "李宗伟", src: "/example/lizhongwei_real_player.jpg" },
  { title: "酱会画成这样", src: "/example/lizhongwei.png" },
    { title: "酱参考了这个明场面", src: "/example/london-olympic-12-9.png" },

  { title: "这是白老师画的", src: "/example/bailaoshi.png" },
    { title: "白老师蛮抽象的", src: "/example/lizhongwei-mugunren.jpg" },
  { title: "秋宇的画应该像这个。但用我做的绘画工具，她应该画不成这样", src: "/example/qiuyu.jpg" },

] as const;

export default function ExampleModal() {
  const [showExample, setShowExample] = useState(false);
  const [zoomedSrc, setZoomedSrc] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowExample(true)}
        className="text-sm font-medium text-zinc-500 underline underline-offset-4 active:opacity-60"
      >
        查看示例
      </button>

      {showExample && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setShowExample(false)}
        >
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setShowExample(false)}
            className="absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg active:scale-95"
            style={{ top: "max(1rem, env(safe-area-inset-top))", right: "1rem" }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className="flex w-full max-w-xs flex-col gap-4 overflow-y-auto rounded-2xl bg-white p-4"
            style={{ maxHeight: "calc(100vh - 6rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {EXAMPLES.map((example, i) => (
              <ExampleCard
                key={example.src}
                label={example.title || `示例 ${i + 1}`}
                src={example.src}
                onZoom={() => setZoomedSrc(example.src)}
              />
            ))}
          </div>
        </div>
      )}

      {zoomedSrc && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
          onClick={() => setZoomedSrc(null)}
        >
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setZoomedSrc(null)}
            className="absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg active:scale-95"
            style={{ top: "max(1rem, env(safe-area-inset-top))", right: "1rem" }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <div className="relative h-full w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Image src={zoomedSrc} alt="" fill className="object-contain" />
          </div>
        </div>
      )}
    </>
  );
}

function ExampleCard({ label, src, onZoom }: { label: string; src: string; onZoom: () => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-400">{label}</span>
      <button
        type="button"
        onClick={onZoom}
        className="relative h-48 w-full overflow-hidden rounded-xl bg-zinc-100 active:scale-[0.98]"
      >
        <Image src={src} alt={label} fill className="object-contain" />
      </button>
    </div>
  );
}
