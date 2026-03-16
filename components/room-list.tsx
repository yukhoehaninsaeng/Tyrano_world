"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Room = {
  id: string;
  name: string;
  slug: string;
  concept: string;
  description: string | null;
  isPrivate: boolean;
  messageCount: number;
  participantCount: number;
  unreadParticipantsCount: number;
};

export function RoomList({ initialRooms }: { initialRooms: Room[] }) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);

  // 5초마다 방 목록 갱신 → 다른 사람이 방을 만들어도 자동으로 보임
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await fetch("/api/rooms", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setRooms(data);
        }
      } catch {
        // 네트워크 오류 시 기존 목록 유지
      }
    };

    const timer = setInterval(fetchRooms, 5000);
    return () => clearInterval(timer);
  }, []);

  if (!rooms.length) {
    return <p>아직 채팅방이 없습니다. 아래에서 첫 번째 방을 만들어 보세요.</p>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
      {rooms.map((room) => (
        <li key={room.id} className="card" style={{ padding: 14 }}>
          <Link href={`/rooms/${room.slug}`} style={{ display: "grid", gap: 6 }}>
            <strong>
              {room.isPrivate ? "비공개" : "공개"} {room.name}
            </strong>
            <p style={{ margin: 0, color: "#aee7bf" }}>{room.concept}</p>
            <small>
              메시지 {room.messageCount}개, 참여 {room.participantCount}명, 미열람{" "}
              {room.unreadParticipantsCount}명
            </small>
          </Link>
        </li>
      ))}
    </ul>
  );
}
