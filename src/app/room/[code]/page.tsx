import { redirect } from "next/navigation";
import RoomGameLoader from "@/components/RoomGameLoader";
import { sanitizeRoomCode } from "@/lib/room";

export default async function RoomPage({ params }: PageProps<"/room/[code]">) {
  const { code } = await params;
  const sanitized = sanitizeRoomCode(decodeURIComponent(code));
  if (!sanitized) {
    redirect("/");
  }

  return (
    <div className="h-full flex-1">
      <RoomGameLoader roomCode={sanitized} />
    </div>
  );
}
