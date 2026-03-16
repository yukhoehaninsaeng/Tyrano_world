import { NextResponse } from "next/server";

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function createDatabaseUnavailableResponse() {
  return NextResponse.json(
    {
      message: "데이터베이스가 아직 연결되지 않았습니다. Vercel 환경 변수 DATABASE_URL과 DB 스키마를 확인해 주세요."
    },
    { status: 503 }
  );
}
