"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import type { StrokeSegment } from "@/lib/room";

// Kept in one place so it always matches DrawingBoard.tsx's court image styling.
const COURT_SCALE = 1.15;
const COURT_TRANSLATE_X_PCT = -5;
const COURT_TRANSLATE_Y_PCT = 4;

type LiveDrawViewerProps = {
  /** Accumulated segments for the current round, in receive order. */
  segments: StrokeSegment[];
  /** Mirrors the drawer's court-background toggle. */
  showCourt?: boolean;
};

// Read-only canvas that replays received stroke segments. Points and widths
// are normalized (0..1 of the drawer's CSS size) by LiveDrawCanvas, so they
// render correctly here regardless of this device's screen size.
export default function LiveDrawViewer({ segments, showCourt = false }: LiveDrawViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const segmentsRef = useRef<StrokeSegment[]>(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const segment of segmentsRef.current) {
      ctx.globalCompositeOperation = segment.tool === "erase" ? "destination-out" : "source-over";
      const pxWidth = segment.width * w;
      const [first, ...rest] = segment.points;
      if (!first) continue;

      if (rest.length === 0) {
        ctx.fillStyle = segment.color;
        ctx.beginPath();
        ctx.arc(first.x * w, first.y * h, pxWidth / 2, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }

      ctx.strokeStyle = segment.color;
      ctx.lineWidth = pxWidth;
      ctx.beginPath();
      ctx.moveTo(first.x * w, first.y * h);
      for (const p of rest) {
        ctx.lineTo(p.x * w, p.y * h);
      }
      ctx.stroke();
    }
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const newPixelWidth = Math.round(width * dpr);
    const newPixelHeight = Math.round(height * dpr);
    if (canvas.width === newPixelWidth && canvas.height === newPixelHeight) return;

    canvas.width = newPixelWidth;
    canvas.height = newPixelHeight;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;
    redraw();
  }, [redraw]);

  useEffect(() => {
    resizeCanvas();
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => resizeCanvas());
    observer.observe(container);
    return () => observer.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    redraw();
  }, [segments, redraw]);

  return (
    <div className="relative h-full w-full">
      {showCourt && (
        <Image
          src="/court/court.webp"
          alt=""
          fill
          priority
          draggable={false}
          className="pointer-events-none select-none object-cover"
          style={{ transform: `scale(${COURT_SCALE}) translate(${COURT_TRANSLATE_X_PCT}%, ${COURT_TRANSLATE_Y_PCT}%)` }}
        />
      )}
      <div ref={containerRef} className="relative z-10 h-full w-full">
        <canvas ref={canvasRef} className="block h-full w-full" />
      </div>
    </div>
  );
}
