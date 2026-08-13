"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { NormalizedPoint, StrokeSegment } from "@/lib/room";

const COLORS = [
  { name: "Black", value: "#000000" },
  { name: "Red", value: "#ef4444" },
  { name: "Blue", value: "#3b82f6" },
] as const;

const THICKNESSES = [
  { name: "Thin", value: 3 },
  { name: "Medium", value: 8 },
  { name: "Thick", value: 16 },
  { name: "Extra thick", value: 28 },
] as const;

// How often in-progress stroke points are flushed to the network.
const FLUSH_INTERVAL_MS = 600;

type Point = { x: number; y: number };

type LiveDrawCanvasProps = {
  /** Called with a batch of normalized points whenever they should be sent
   *  over the network — roughly every FLUSH_INTERVAL_MS while drawing, plus
   *  immediately when a stroke ends. */
  onSegment: (segment: StrokeSegment) => void;
  /** Called when the drawer clears the canvas, so the viewer can clear too. */
  onClear: () => void;
};

export default function LiveDrawCanvas({ onSegment, onClear }: LiveDrawCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const drawingPointerIdRef = useRef<number | null>(null);
  const cssSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  // Points captured since the last flush, for the network — kept separate
  // from on-screen rendering, which happens immediately/locally regardless.
  const pendingPointsRef = useRef<NormalizedPoint[]>([]);
  const strokeMetaRef = useRef<{ color: string; width: number; tool: "draw" | "erase" } | null>(null);
  const hasNewPointsRef = useRef(false);

  const [color, setColor] = useState<string>(COLORS[0].value);
  const [lineWidth, setLineWidth] = useState<number>(THICKNESSES[1].value);
  const [tool, setTool] = useState<"draw" | "erase">("draw");

  const colorRef = useRef(color);
  const lineWidthRef = useRef(lineWidth);
  const toolRef = useRef(tool);
  useEffect(() => {
    colorRef.current = color;
  }, [color]);
  useEffect(() => {
    lineWidthRef.current = lineWidth;
  }, [lineWidth]);
  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  const onSegmentRef = useRef(onSegment);
  useEffect(() => {
    onSegmentRef.current = onSegment;
  }, [onSegment]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;
    cssSizeRef.current = { width, height };

    const dpr = window.devicePixelRatio || 1;
    const newPixelWidth = Math.round(width * dpr);
    const newPixelHeight = Math.round(height * dpr);
    if (canvas.width === newPixelWidth && canvas.height === newPixelHeight) return;

    // Setting canvas.width/height clears the bitmap, so snapshot the current
    // drawing first and paint it back afterward — otherwise any layout shift
    // (e.g. the chat feed appearing) would wipe the drawer's own strokes.
    const snapshot = document.createElement("canvas");
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    const snapshotCtx = snapshot.getContext("2d");
    if (snapshotCtx && canvas.width > 0 && canvas.height > 0) {
      snapshotCtx.drawImage(canvas, 0, 0);
    }

    canvas.width = newPixelWidth;
    canvas.height = newPixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (canvas.width > 0 && canvas.height > 0) {
      ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, canvas.width, canvas.height);
    }
    ctxRef.current = ctx;
  }, []);

  useEffect(() => {
    resizeCanvas();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(container);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  const flushPending = (force: boolean) => {
    const meta = strokeMetaRef.current;
    const points = pendingPointsRef.current;
    if (!meta || points.length === 0) return;
    if (!force && !hasNewPointsRef.current) return;
    onSegmentRef.current({ ...meta, points: [...points] });
    // Keep the last point as the seed for the next segment, so consecutive
    // flushes of the same stroke render as one continuous line.
    pendingPointsRef.current = [points[points.length - 1]];
    hasNewPointsRef.current = false;
  };

  // Periodically flush new points from the in-progress stroke (skipped when
  // nothing moved since the last flush, so a paused/held pointer doesn't spam
  // redundant single-point segments).
  useEffect(() => {
    const interval = setInterval(() => {
      flushPending(false);
    }, FLUSH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const normalize = (p: Point): NormalizedPoint => {
    const { width, height } = cssSizeRef.current;
    return { x: width > 0 ? p.x / width : 0, y: height > 0 ? p.y / height : 0 };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingPointerIdRef.current = e.pointerId;
    const point = getPoint(e);
    lastPointRef.current = point;

    strokeMetaRef.current = {
      color: colorRef.current,
      width: lineWidthRef.current / Math.max(cssSizeRef.current.width, 1),
      tool: toolRef.current,
    };
    pendingPointsRef.current = [normalize(point)];

    const ctx = ctxRef.current;
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.globalCompositeOperation = toolRef.current === "erase" ? "destination-out" : "source-over";
    ctx.fillStyle = colorRef.current;
    ctx.beginPath();
    ctx.arc(point.x * dpr, point.y * dpr, (lineWidthRef.current * dpr) / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingPointerIdRef.current !== e.pointerId) return;
    const ctx = ctxRef.current;
    const lastPoint = lastPointRef.current;
    if (!ctx || !lastPoint) return;

    const point = getPoint(e);
    const dpr = window.devicePixelRatio || 1;
    ctx.globalCompositeOperation = toolRef.current === "erase" ? "destination-out" : "source-over";
    ctx.strokeStyle = colorRef.current;
    ctx.lineWidth = lineWidthRef.current * dpr;
    ctx.beginPath();
    ctx.moveTo(lastPoint.x * dpr, lastPoint.y * dpr);
    ctx.lineTo(point.x * dpr, point.y * dpr);
    ctx.stroke();

    lastPointRef.current = point;
    pendingPointsRef.current.push(normalize(point));
    hasNewPointsRef.current = true;
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingPointerIdRef.current !== e.pointerId) return;
    drawingPointerIdRef.current = null;
    lastPointRef.current = null;
    flushPending(true);
    strokeMetaRef.current = null;
    pendingPointsRef.current = [];
    hasNewPointsRef.current = false;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-none items-start justify-end p-2">
        <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-zinc-200 bg-white/95 p-1.5 shadow-lg backdrop-blur">
          <div className="flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                aria-label={c.name}
                aria-pressed={tool === "draw" && color === c.value}
                onClick={() => {
                  setColor(c.value);
                  setTool("draw");
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
              onClick={() => setTool("erase")}
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
            {THICKNESSES.map((t) => (
              <button
                key={t.value}
                type="button"
                aria-label={t.name}
                aria-pressed={lineWidth === t.value}
                onClick={() => setLineWidth(t.value)}
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
                  lineWidth === t.value
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white text-zinc-700"
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: Math.min(t.value, 18), height: Math.min(t.value, 18) }}
                />
              </button>
            ))}
          </div>

          <div className="h-px w-full bg-zinc-200" />

          <button
            type="button"
            aria-label="Clear canvas"
            onClick={handleClear}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-white active:scale-95"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-hidden px-2 pb-2">
        <div
          className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
          style={{ width: "100%", height: "100%" }}
        >
          <div ref={containerRef} className="h-full w-full touch-none">
            <canvas
              ref={canvasRef}
              className="block h-full w-full touch-none"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={endStroke}
              onPointerLeave={endStroke}
              onPointerCancel={endStroke}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
