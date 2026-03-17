import { NextRequest, NextResponse } from "next/server";

import { createDatabaseUnavailableResponse, isDatabaseConfigured } from "@/lib/db-errors";
import { prisma } from "@/lib/prisma";

type CreateRoomPayload = {
  name?: string;
  slug?: string;
  concept?: string;
  description?: string;
  isPrivate?: boolean;
};

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export async function GET() {
  if (!isDatabaseConfigured()) {
    return createDatabaseUnavailableResponse();
  }

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

    const rooms = dbRooms.map((room) => {
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

    return NextResponse.json(rooms, { status: 200 });
  } catch {
    return NextResponse.json({ message: "방 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return createDatabaseUnavailableResponse();
  }

  let payload: CreateRoomPayload;

  try {
    payload = (await request.json()) as CreateRoomPayload;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  const concept = String(payload.concept ?? "").trim();
  const description = String(payload.description ?? "").trim();
  const isPrivate = Boolean(payload.isPrivate);
  const slugInput = String(payload.slug ?? "").trim();
  const slug = normalizeSlug(slugInput || name);

  if (!name || !concept || !slug) {
    return NextResponse.json({ message: "이름, 슬러그, 컨셉은 필수입니다." }, { status: 400 });
  }

  try {
    const exists = await prisma.room.findUnique({ where: { slug }, select: { id: true } });
    if (exists) {
      return NextResponse.json({ message: "이미 사용 중인 슬러그입니다." }, { status: 409 });
    }

    const room = await prisma.room.create({
      data: {
        name,
        slug,
        concept,
        description: description || null,
        isPrivate
      }
    });

    return NextResponse.json(room, { status: 201 });
  } catch {
    return NextResponse.json({ message: "방 생성에 실패했습니다." }, { status: 500 });
  }
}
