// Shared between client and server: event payload shapes, channel naming,
// and room-code sanitizing for multiplayer rooms.

/** Normalized to 0..1 relative to the drawer's canvas size, so strokes render
 *  correctly regardless of the two players' screen sizes. */
export type NormalizedPoint = { x: number; y: number };

export type StrokeSegment = {
  color: string;
  /** Line width as a fraction of canvas width, for the same resolution-independence. */
  width: number;
  tool: "draw" | "erase";
  points: NormalizedPoint[];
};

export type ChatMessage = {
  id: string;
  senderId: string;
  text: string;
};

export type RoomEvent =
  | { type: "stroke-batch"; roundIndex: number; segment: StrokeSegment }
  | { type: "clear-canvas"; roundIndex: number }
  | { type: "court-toggle"; visible: boolean }
  | { type: "chat-message"; message: ChatMessage }
  | { type: "round-advance"; roundIndex: number };

/** The single Pusher event name all RoomEvent payloads are sent under. */
export const ROOM_EVENT_NAME = "room-event";

const MAX_ROOM_CODE_LENGTH = 20;

/** Keeps only characters Pusher channel names and URL segments both allow. */
export function sanitizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_ROOM_CODE_LENGTH);
}

export function roomChannelName(code: string): string {
  return `presence-room-${code}`;
}
