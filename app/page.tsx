import { CreateRoomForm } from "@/components/create-room-form";
import { RoomList } from "@/components/room-list";
import { ChatShell } from "@/components/chat-shell";
import { isDatabaseConfigured } from "@/lib/db-errors";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0; // 캐시 완전 비활성화

type RoomSummary = {
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

export default async function HomePage() {
  let rooms: RoomSummary[] = [];
  let dbWarning: string | null = null;

  if (!isDatabaseConfigured()) {
    dbWarning = "DATABASE_URL이 설정되지 않아 방 목록을 불러올 수 없습니다.";
  } else {
    try {
      const dbRooms = await prisma.room.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { messages: true, participants: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: { reads: true }
          }
        }
      });

      rooms = dbRooms.map((room) => {
        const latestMessage = room.messages[0];
        const unreadParticipantsCount = latestMessage
          ? Math.max(0, room._count.participants - latestMessage.reads.length)
          : 0;

        return {
          id: room.id,
          name: room.name,
          slug: room.slug,
          concept: room.concept,
          description: room.description,
          isPrivate: room.isPrivate,
          messageCount: room._count.messages,
          participantCount: room._count.participants,
          unreadParticipantsCount
        };
      });
    } catch {
      dbWarning = "데이터베이스 연결에 실패했습니다. 환경 변수와 Prisma 스키마 반영 상태를 확인해 주세요.";
    }
  }

  return (
    <main style={{ display: "grid", gap: 18 }}>
      <header style={{ display: "grid", gap: 10 }}>
        <p style={{ color: "#9de9b5", margin: 0 }}>Hungry Tyrano Open Chat</p>
        <h1 style={{ margin: 0 }}>배고픈 티라노 채팅 라운지</h1>
        <p style={{ lineHeight: 1.5, opacity: 0.9, margin: 0 }}>
          먼저 열려 있는 채팅방을 둘러보고, 필요하면 새 방을 만들어 바로 대화를 시작할 수 있습니다.
        </p>
        {dbWarning ? <p style={{ margin: 0, color: "#ffb3b3" }}>{dbWarning}</p> : null}
      </header>

      <section className="card" style={{ padding: 0, height: "70vh" }}>
        <ChatShell />
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>채팅방 리스트</h2>
        {/* initialRooms: 서버에서 첫 렌더, 이후 클라이언트가 5초마다 자동 갱신 */}
        <RoomList initialRooms={rooms} />
      </section>

      <section className="card" style={{ padding: 16 }}>
        <h2 style={{ marginTop: 0 }}>새 채팅방 만들기</h2>
        <CreateRoomForm />
      </section>
    </main>
  );
}