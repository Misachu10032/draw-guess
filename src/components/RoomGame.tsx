"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type PusherType from "pusher-js";
import type { PresenceChannel } from "pusher-js";
import { createPusherClient } from "@/lib/pusher-client";
import { PLAYERS } from "@/lib/players";
import {
  ROOM_EVENT_NAME,
  roomChannelName,
  type ChatMessage,
  type RoomEvent,
  type StrokeSegment,
} from "@/lib/room";
import LiveDrawCanvas, { type LiveDrawCanvasHandle } from "@/components/LiveDrawCanvas";
import LiveDrawViewer from "@/components/LiveDrawViewer";
import RoundReviewPanel from "@/components/RoundReviewPanel";
import DrawToolbar, { TOOLBAR_COLORS, TOOLBAR_THICKNESSES } from "@/components/DrawToolbar";

const TOTAL_ROUNDS = PLAYERS.length;

type Status = "connecting" | "waiting" | "playing" | "room-full" | "opponent-left" | "error";

type RoomGameProps = {
  roomCode: string;
};

export default function RoomGame({ roomCode }: RoomGameProps) {
  const [userId] = useState(() => crypto.randomUUID());
  const [status, setStatus] = useState<Status>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [myPlayerNumber, setMyPlayerNumber] = useState<1 | 2 | null>(null);
  const [roundIndex, setRoundIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  // Indexed by round, and never cleared on round-advance — kept around so the
  // review panel can replay any past round's actual live-drawn strokes.
  const [roundStrokes, setRoundStrokes] = useState<StrokeSegment[][]>(() =>
    Array.from({ length: TOTAL_ROUNDS }, () => [])
  );
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [guessDraft, setGuessDraft] = useState("");
  const [viewMode, setViewMode] = useState<"drawing" | "photo">("drawing");
  // Mirrors the drawer's court toggle for the guesser's view — defaults to
  // true each round, matching the toolbar's own per-round default.
  const [courtVisible, setCourtVisible] = useState(true);
  // Drawing tool state lives here (not inside LiveDrawCanvas) so the toolbar
  // can be rendered next to the round review panel instead of inside the
  // canvas component itself.
  const [color, setColor] = useState<string>(TOOLBAR_COLORS[0].value);
  const [lineWidth, setLineWidth] = useState<number>(TOOLBAR_THICKNESSES[1].value);
  const [tool, setTool] = useState<"draw" | "erase">("draw");

  const channelRef = useRef<PresenceChannel | null>(null);
  const canvasHandleRef = useRef<LiveDrawCanvasHandle | null>(null);

  useEffect(() => {
    let pusher: PusherType | null = null;
    try {
      pusher = createPusherClient(userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to connect";
      queueMicrotask(() => {
        setErrorMessage(message);
        setStatus("error");
      });
      return;
    }

    const channel = pusher.subscribe(roomChannelName(roomCode)) as PresenceChannel;
    channelRef.current = channel;

    channel.bind("pusher:subscription_succeeded", () => {
      const count = channel.members.count;
      if (count > 2) {
        setStatus("room-full");
        return;
      }
      setMyPlayerNumber(count === 1 ? 1 : 2);
      setStatus(count >= 2 ? "playing" : "waiting");
    });

    channel.bind("pusher:subscription_error", () => {
      setErrorMessage("无法连接到房间，请检查网络后重试。");
      setStatus("error");
    });

    channel.bind("pusher:member_added", () => {
      setStatus((prev) => {
        if (channel.members.count > 2) return "room-full";
        return prev === "waiting" ? "playing" : prev;
      });
    });

    channel.bind("pusher:member_removed", () => {
      setStatus((prev) => (prev === "playing" ? "opponent-left" : prev));
    });

    channel.bind(ROOM_EVENT_NAME, (event: RoomEvent) => {
      if (event.type === "stroke-batch") {
        setRoundStrokes((prev) => {
          const next = prev.slice();
          next[event.roundIndex] = [...(next[event.roundIndex] ?? []), event.segment];
          return next;
        });
      } else if (event.type === "clear-canvas") {
        setRoundStrokes((prev) => {
          const next = prev.slice();
          next[event.roundIndex] = [];
          return next;
        });
      } else if (event.type === "court-toggle") {
        setCourtVisible(event.visible);
      } else if (event.type === "chat-message") {
        setChatMessages((prev) => [...prev, event.message]);
      } else if (event.type === "round-advance") {
        setRoundIndex(event.roundIndex);
        setFinished(event.roundIndex >= TOTAL_ROUNDS);
        setChatMessages([]);
        setGuessDraft("");
        setViewMode("drawing");
        setCourtVisible(true);
      }
    });

    return () => {
      pusher?.unsubscribe(roomChannelName(roomCode));
      pusher?.disconnect();
    };
  }, [roomCode, userId]);

  const sendRoomEvent = (event: RoomEvent) => {
    fetch(`/api/room/${roomCode}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }).catch(() => {
      // Best-effort — a dropped stroke/chat batch isn't worth surfacing to the
      // player; the next periodic flush or message will follow shortly.
    });
  };

  const amIDrawer =
    myPlayerNumber !== null && (myPlayerNumber === 1 ? roundIndex % 2 === 0 : roundIndex % 2 === 1);
  const player = PLAYERS[Math.min(roundIndex, TOTAL_ROUNDS - 1)];
  const isLastRound = roundIndex === TOTAL_ROUNDS - 1;
  const hasGuessedThisRound = chatMessages.some((m) => m.senderId === userId);
  // A round only shows up in the review panel once it's fully over, for both
  // players alike — not as soon as you personally know the answer.
  const unlockedCount = finished ? TOTAL_ROUNDS : roundIndex;

  const handleAdvance = () => {
    sendRoomEvent({ type: "round-advance", roundIndex: roundIndex + 1 });
  };

  const handleToggleCourt = () => {
    setCourtVisible((v) => {
      const next = !v;
      sendRoomEvent({ type: "court-toggle", visible: next });
      return next;
    });
  };

  const handleClearCanvas = () => {
    canvasHandleRef.current?.clear();
    sendRoomEvent({ type: "clear-canvas", roundIndex });
  };

  const handleSendGuess = () => {
    const text = guessDraft.trim();
    if (!text) return;
    setGuessDraft("");
    sendRoomEvent({ type: "chat-message", message: { id: crypto.randomUUID(), senderId: userId, text } });
  };

  const renderRoundDrawing = (i: number) => (
    <div className="h-full w-full bg-white">
      <LiveDrawViewer segments={roundStrokes[i] ?? []} />
    </div>
  );

  if (status !== "playing" && !finished) {
    return (
      <StatusScreen
        status={status}
        roomCode={roomCode}
        errorMessage={errorMessage}
        amIDrawer={amIDrawer}
        myPlayerNumber={myPlayerNumber}
      />
    );
  }

  if (finished) {
    return (
      <div
        className="flex h-full w-full flex-col items-center justify-center gap-6 overflow-y-auto bg-zinc-50 px-6 py-8 text-center"
        style={{
          paddingTop: "max(2rem, env(safe-area-inset-top))",
          paddingBottom: "max(2rem, env(safe-area-inset-bottom))",
        }}
      >
        <p className="text-2xl font-bold text-zinc-900">你们完成了全部 {TOTAL_ROUNDS} 轮！</p>
        <RoundReviewPanel entries={PLAYERS} unlockedCount={unlockedCount} renderDrawing={renderRoundDrawing} />
        <Link
          href="/"
          className="flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white active:scale-95"
        >
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-zinc-50">
      <div
        className="flex flex-none flex-col gap-1.5 px-3 pb-1.5"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))" }}
      >
        <div className="flex items-start justify-center gap-2">
          <div className="min-w-0 flex-1">
            <RoundReviewPanel entries={PLAYERS} unlockedCount={unlockedCount} renderDrawing={renderRoundDrawing} />
          </div>
          {amIDrawer && (
            <DrawToolbar
              color={color}
              onColorChange={setColor}
              lineWidth={lineWidth}
              onLineWidthChange={setLineWidth}
              tool={tool}
              onToolChange={setTool}
              showCourt={courtVisible}
              onToggleCourt={handleToggleCourt}
              onClear={handleClearCanvas}
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-2 text-xs font-medium text-zinc-400">
          <span>
            第 {roundIndex + 1} / {TOTAL_ROUNDS} 轮
          </span>
          <span className="text-zinc-300">·</span>
          <span>{amIDrawer ? "你在画" : "你在猜"}</span>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {amIDrawer ? (
          <DrawerView
            key={roundIndex}
            player={player}
            chatMessages={chatMessages}
            isLastRound={isLastRound}
            color={color}
            lineWidth={lineWidth}
            tool={tool}
            showCourt={courtVisible}
            canvasRef={canvasHandleRef}
            onSegment={(segment) => sendRoomEvent({ type: "stroke-batch", roundIndex, segment })}
            onAdvance={handleAdvance}
          />
        ) : (
          <GuesserView
            player={player}
            strokes={roundStrokes[roundIndex] ?? []}
            showCourt={courtVisible}
            chatMessages={chatMessages}
            myUserId={userId}
            hasGuessed={hasGuessedThisRound}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            guessDraft={guessDraft}
            onGuessDraftChange={setGuessDraft}
            onSendGuess={handleSendGuess}
          />
        )}
      </div>
    </div>
  );
}

function StatusScreen({
  status,
  roomCode,
  errorMessage,
  amIDrawer,
  myPlayerNumber,
}: {
  status: Status;
  roomCode: string;
  errorMessage: string | null;
  amIDrawer: boolean;
  myPlayerNumber: 1 | 2 | null;
}) {
  const message = (() => {
    switch (status) {
      case "connecting":
        return "正在连接房间...";
      case "waiting":
        return `等待对方加入房间 ${roomCode}...`;
      case "room-full":
        return "房间已满（最多 2 人）。";
      case "opponent-left":
        return "对方已离开房间。";
      case "error":
        return errorMessage ?? "连接出错，请稍后重试。";
      default:
        return "";
    }
  })();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center">
      <p className="text-lg font-semibold text-zinc-900">{message}</p>
      {status === "waiting" && (
        <p className="text-sm text-zinc-500">把房间号 {roomCode} 分享给对方，让 ta 在首页输入加入。</p>
      )}
      {myPlayerNumber !== null && status === "waiting" && (
        <p className="text-xs text-zinc-400">{amIDrawer ? "你将先画" : "你将先猜"}</p>
      )}
      <Link
        href="/"
        className="mt-2 flex h-11 items-center justify-center rounded-full bg-zinc-900 px-6 text-sm font-medium text-white active:scale-95"
      >
        返回首页
      </Link>
    </div>
  );
}

function DrawerView({
  player,
  chatMessages,
  isLastRound,
  color,
  lineWidth,
  tool,
  showCourt,
  canvasRef,
  onSegment,
  onAdvance,
}: {
  player: (typeof PLAYERS)[number];
  chatMessages: ChatMessage[];
  isLastRound: boolean;
  color: string;
  lineWidth: number;
  tool: "draw" | "erase";
  showCourt: boolean;
  canvasRef: React.RefObject<LiveDrawCanvasHandle | null>;
  onSegment: (segment: StrokeSegment) => void;
  onAdvance: () => void;
}) {
  const [showPhoto, setShowPhoto] = useState(false);

  return (
    <div className="relative flex h-full w-full flex-col">
      <LiveDrawCanvas
        ref={canvasRef}
        color={color}
        lineWidth={lineWidth}
        tool={tool}
        showCourt={showCourt}
        onSegment={onSegment}
      />

      <button
        type="button"
        aria-label="查看真人照片"
        onClick={() => setShowPhoto(true)}
        className="absolute left-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border-2 border-zinc-300 bg-white/95 text-zinc-700 shadow-lg backdrop-blur active:scale-95"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {chatMessages.length > 0 && (
        <div
          className="absolute inset-x-3 z-10 flex max-h-24 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white/95 p-2 shadow-lg backdrop-blur"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
        >
          {chatMessages.map((m) => (
            <p key={m.id} className="truncate text-xs text-zinc-600">
              对方猜：{m.text}
            </p>
          ))}
        </div>
      )}

      <div
        className="flex flex-none items-center justify-center px-4 pt-1"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={onAdvance}
          className="h-11 rounded-full bg-zinc-900 px-8 text-sm font-medium text-white active:scale-95"
        >
          {isLastRound ? "完成" : "下一轮"}
        </button>
      </div>

      {showPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
          onClick={() => setShowPhoto(false)}
        >
          <button
            type="button"
            aria-label="关闭"
            onClick={() => setShowPhoto(false)}
            className="absolute z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg active:scale-95"
            style={{ top: "max(1rem, env(safe-area-inset-top))", right: "1rem" }}
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
          <div className="relative h-full w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <Image src={player.photoSrc} alt={player.name} fill className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

function GuesserView({
  player,
  strokes,
  showCourt,
  chatMessages,
  myUserId,
  hasGuessed,
  viewMode,
  onViewModeChange,
  guessDraft,
  onGuessDraftChange,
  onSendGuess,
}: {
  player: (typeof PLAYERS)[number];
  strokes: StrokeSegment[];
  showCourt: boolean;
  chatMessages: ChatMessage[];
  myUserId: string;
  hasGuessed: boolean;
  viewMode: "drawing" | "photo";
  onViewModeChange: (mode: "drawing" | "photo") => void;
  guessDraft: string;
  onGuessDraftChange: (value: string) => void;
  onSendGuess: () => void;
}) {
  return (
    <div className="relative flex h-full w-full flex-col">
      <div className="flex flex-1 items-start justify-center overflow-hidden px-2 pt-1">
        <div
          className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
          style={{ width: "100%", height: "100%" }}
        >
          {hasGuessed && (
            <div className="absolute left-2 top-2 z-10 flex gap-1.5">
              <button
                type="button"
                aria-pressed={viewMode === "photo"}
                onClick={() => onViewModeChange("photo")}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                  viewMode === "photo"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white/95 text-zinc-700"
                }`}
              >
                真人照片
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "drawing"}
                onClick={() => onViewModeChange("drawing")}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                  viewMode === "drawing"
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 bg-white/95 text-zinc-700"
                }`}
              >
                查看画作
              </button>
            </div>
          )}

          {viewMode === "photo" && hasGuessed ? (
            <Image src={player.photoSrc} alt="" fill className="object-contain" />
          ) : (
            <LiveDrawViewer segments={strokes} showCourt={showCourt} />
          )}
        </div>
      </div>

      {chatMessages.length > 0 && (
        <div
          className="absolute inset-x-3 z-10 flex max-h-20 flex-col gap-1 overflow-y-auto rounded-xl border border-zinc-200 bg-white/95 p-2 shadow-lg backdrop-blur"
          style={{ bottom: "calc(4.5rem + env(safe-area-inset-bottom))" }}
        >
          {chatMessages.map((m) => (
            <p key={m.id} className="truncate text-xs text-zinc-600">
              {m.senderId === myUserId ? "我猜：" : "对方："}
              {m.text}
            </p>
          ))}
        </div>
      )}

      <div
        className="flex flex-none items-center gap-2 px-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <input
          type="text"
          value={guessDraft}
          onChange={(e) => onGuessDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSendGuess();
          }}
          placeholder="这是谁？发送你的猜测"
          className="h-11 min-w-0 flex-1 rounded-full border-2 border-zinc-300 bg-white px-4 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={onSendGuess}
          disabled={!guessDraft.trim()}
          className="h-11 shrink-0 rounded-full bg-zinc-900 px-5 text-sm font-medium text-white active:scale-95 disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  );
}
