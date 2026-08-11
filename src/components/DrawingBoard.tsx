"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

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

// Kept in one place so the exported PNG's compositing math always matches the
// CSS transform applied to the on-screen court image.
const COURT_SCALE = 1.15;
const COURT_TRANSLATE_X_PCT = -5;
const COURT_TRANSLATE_Y_PCT = 4;

type Point = { x: number; y: number };

export default function DrawingBoard() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPointRef = useRef<Point | null>(null);
  const drawingPointerIdRef = useRef<number | null>(null);
  const courtImgRef = useRef<HTMLImageElement | null>(null);

  const [color, setColor] = useState<string>(COLORS[0].value);
  const [lineWidth, setLineWidth] = useState<number>(THICKNESSES[1].value);
  const [tool, setTool] = useState<"draw" | "erase">("draw");
  const [showCourt, setShowCourt] = useState<boolean>(true);

  // Keep latest color/lineWidth/tool available inside event handlers without re-binding them.
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

  // Set up the canvas backing store to match its displayed (CSS) size at the
  // device pixel ratio, preserving existing strokes across resizes.
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const newPixelWidth = Math.round(width * dpr);
    const newPixelHeight = Math.round(height * dpr);
    if (canvas.width === newPixelWidth && canvas.height === newPixelHeight) {
      return;
    }

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

  const getPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingPointerIdRef.current = e.pointerId;
    const point = getPoint(e);
    lastPointRef.current = point;

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
  };

  const endStroke = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (drawingPointerIdRef.current !== e.pointerId) return;
    drawingPointerIdRef.current = null;
    lastPointRef.current = null;
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = canvas.width;
    exportCanvas.height = canvas.height;
    const exportCtx = exportCanvas.getContext("2d");
    if (!exportCtx) return;

    const w = canvas.width;
    const h = canvas.height;
    exportCtx.fillStyle = "#ffffff";
    exportCtx.fillRect(0, 0, w, h);

    const courtImg = courtImgRef.current;
    if (showCourt && courtImg && courtImg.complete && courtImg.naturalWidth > 0) {
      // Replicate the CSS object-fit: cover + transform applied to the on-screen
      // court image, so the exported PNG matches what's actually visible.
      const coverScale = Math.max(w / courtImg.naturalWidth, h / courtImg.naturalHeight);
      const baseW = courtImg.naturalWidth * coverScale;
      const baseH = courtImg.naturalHeight * coverScale;
      const baseX = (w - baseW) / 2;
      const baseY = (h - baseH) / 2;

      const cx = w / 2;
      const cy = h / 2;
      const tx = (COURT_TRANSLATE_X_PCT / 100) * w;
      const ty = (COURT_TRANSLATE_Y_PCT / 100) * h;

      const destW = baseW * COURT_SCALE;
      const destH = baseH * COURT_SCALE;
      const destX = cx + COURT_SCALE * (baseX - cx + tx);
      const destY = cy + COURT_SCALE * (baseY - cy + ty);

      exportCtx.drawImage(courtImg, destX, destY, destW, destH);
    }

    exportCtx.drawImage(canvas, 0, 0);

    exportCanvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `drawing-${Date.now()}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <div className="flex h-full w-full flex-col bg-zinc-50">
      <div
        className="flex flex-none items-start justify-end p-2"
        style={{ height: "25%", paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
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

          <div className="flex gap-1.5">
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

            <button
              type="button"
              aria-label="Toggle court background"
              aria-pressed={showCourt}
              onClick={() => setShowCourt((v) => !v)}
              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
                showCourt ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 bg-white text-zinc-700"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="4" y="3" width="16" height="18" rx="1" strokeLinejoin="round" />
                <path d="M4 9h16M4 15h16M12 3v18" strokeLinecap="round" />
              </svg>
            </button>

            <button
              type="button"
              aria-label="Save drawing"
              onClick={handleSave}
              className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-zinc-700 transition-colors active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 4v11m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 19h14" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-start justify-center overflow-hidden">
        <div
          className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
          style={{ width: "95%", height: "92%" }}
        >
          {showCourt && (
            <Image
              ref={courtImgRef}
              src="/court/court.webp"
              alt=""
              fill
              priority
              draggable={false}
              className="pointer-events-none select-none object-cover"
              style={{ transform: `scale(${COURT_SCALE}) translate(${COURT_TRANSLATE_X_PCT}%, ${COURT_TRANSLATE_Y_PCT}%)` }}
            />
          )}
          <div ref={containerRef} className="relative z-10 h-full w-full touch-none">
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
