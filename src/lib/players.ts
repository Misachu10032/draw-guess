export type PlayerId = "lizijia" | "momota" | "shida" | "shiyuqi" | "fengyun" | "nini";

export type Player = {
  id: PlayerId;
  name: string;
  /** Stylized drawing shown during the guess phase. */
  drawnSrc: string;
  /** Real photo revealed after the player confirms a guess. */
  photoSrc: string;
};

// Fixed round order (not randomized) and display names, as specified.
export const PLAYERS: readonly Player[] = [
  { id: "lizijia", name: "李梓嘉", drawnSrc: "/john-drew/lizijia.png", photoSrc: "/players/lizijia.jpg" },
  { id: "momota", name: "momota", drawnSrc: "/john-drew/momota.png", photoSrc: "/players/momota.webp" },
  { id: "shida", name: "志田千阳", drawnSrc: "/john-drew/shida.png", photoSrc: "/players/shida.jpg" },
  { id: "shiyuqi", name: "石宇奇", drawnSrc: "/john-drew/shiyuqi.png", photoSrc: "/players/shiyuqi.jpg" },
  { id: "fengyun", name: "风云", drawnSrc: "/john-drew/fengyun.png", photoSrc: "/players/fengyun.jpeg" },
  { id: "nini", name: "妮妮", drawnSrc: "/john-drew/nini.png", photoSrc: "/players/nini.jpg" },
];
