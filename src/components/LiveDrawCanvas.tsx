"use client";

import Image from "next/image";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { NormalizedPoint, StrokeSegment } from "@/lib/room";

// How often in-progress stroke points are flushed to the network.
const FLUSH_INTERVAL_MS = 600;

// Kept in one place so it always matches DrawingBoard.tsx's court image styling.
const COURT_SCALE = 1.15;
const COURT_TRANSLATE_X_PCT = -5;
const COURT_TRANSLATE_Y_PCT = 4;

type Point = { x: number; y: number };

export type LiveDrawCanvasHandle = {
  /** Wipes the canvas bitmap. Doesn't broadcast anything — the caller (which
   *  owns the "clear" button) is responsible for sending the network event. */
  clear: () => void;
};

type LiveDrawCanvasProps = {
  color: string;
  lineWidth: number;
  tool: "draw" | "erase";
  showCourt: boolean;
  /** Called with a batch of normalized points whenever they should be sent
   *  over the network — roughly every FLUSH_INTERVAL_MS while drawing, plus
   *  immediately when a stroke ends. */
  onSegment: (segment: StrokeSegment) => void;
};

const LiveDrawCanvas = forwardRef<LiveDrawCanvasHandle, LiveDrawCanvasProps>(function LiveDrawCanvas(
  { color, lineWidth, tool, showCourt, onSegment },
  ref
) {
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

  useImperativeHandle(ref, () => ({
    clear: () => {
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    },
  }));

  return (
    <div className="flex min-h-0 flex-1 items-start justify-center overflow-hidden px-2 pb-2">
      <div
        className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
        style={{ width: "100%", height: "100%" }}
      >
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
  );
});

export default LiveDrawCanvas;
