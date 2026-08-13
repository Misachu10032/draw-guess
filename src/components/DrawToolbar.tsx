"use client";

export const TOOLBAR_COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
] as const;

export const TOOLBAR_THICKNESSES = [
  { name: "Thin", value: 3 },
  { name: "Medium", value: 8 },
  { name: "Thick", value: 16 },
  { name: "Extra thick", value: 28 },
] as const;

type DrawToolbarProps = {
  color: string;
  onColorChange: (color: string) => void;
  lineWidth: number;
  onLineWidthChange: (width: number) => void;
  tool: "draw" | "erase";
  onToolChange: (tool: "draw" | "erase") => void;
  showCourt: boolean;
  onToggleCourt: () => void;
  onClear: () => void;
};

// Controlled toolbar UI, shared by the free-draw board and the multiplayer
// drawer canvas — all state lives in the caller so it can be positioned and
// combined with other UI (e.g. next to the round review panel) as needed.
export default function DrawToolbar({
  color,
  onColorChange,
  lineWidth,
  onLineWidthChange,
  tool,
  onToolChange,
  showCourt,
  onToggleCourt,
  onClear,
}: DrawToolbarProps) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
      <div className="flex gap-1.5">
        {TOOLBAR_COLORS.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={c.name}
            aria-pressed={tool === "draw" && color === c.value}
            onClick={() => {
              onColorChange(c.value);
              onToolChange("draw");
            }}
            className={`h-7 w-7 rounded-full border-2 transition-transform active:scale-95 ${
              tool === "draw" && color === c.value ? "border-zinc-900 scale-110" : "border-zinc-300"
            }`}
            style={{ backgroundColor: c.value }}
          />
        ))}
        <button
          type="button"
          aria-label="Eraser"
          aria-pressed={tool === "erase"}
          onClick={() => onToolChange("erase")}
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
            tool === "erase" ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path
              d="M18 13l-7 7H6l-3-3a1.5 1.5 0 0 1 0-2l10-10a1.5 1.5 0 0 1 2 0l4 4a1.5 1.5 0 0 1 0 2l-2 2z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M9.5 20H20" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="h-px w-full bg-zinc-200" />

      <div className="flex gap-1.5">
        {TOOLBAR_THICKNESSES.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-label={t.name}
            aria-pressed={lineWidth === t.value}
            onClick={() => onLineWidthChange(t.value)}
            className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
              lineWidth === t.value ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"
            }`}
          >
            <span className="rounded-full bg-current" style={{ width: Math.min(t.value, 18), height: Math.min(t.value, 18) }} />
          </button>
        ))}
      </div>

      <div className="h-px w-full bg-zinc-200" />

      <div className="flex gap-1.5">
        <button
          type="button"
          aria-label="Clear canvas"
          onClick={onClear}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white active:scale-95"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <button
          type="button"
          aria-label="Toggle court background"
          aria-pressed={showCourt}
          onClick={onToggleCourt}
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
            showCourt ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="4" y="3" width="16" height="18" rx="1" strokeLinejoin="round" />
            <path d="M4 9h16M4 15h16M12 3v18" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
