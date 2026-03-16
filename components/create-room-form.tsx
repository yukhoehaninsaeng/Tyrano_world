"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function CreateRoomForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    const payload = {
      name: String(formData.get("name") || ""),
      slug: String(formData.get("slug") || "").toLowerCase(),
      concept: String(formData.get("concept") || ""),
      description: String(formData.get("description") || ""),
      isPrivate,
      passcode: String(formData.get("passcode") || "")
    };

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "방 생성에 실패했습니다.");
      }

      const room = await res.json();
      event.currentTarget.reset();
      setIsPrivate(false);

      // 캐시 무효화 후 해당 방으로 이동
      router.refresh();
      router.push(`/rooms/${room.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
      <input name="name" placeholder="채팅방 이름" required maxLength={40} />
      <input
        name="slug"
        placeholder="주소 슬러그 (예: hungry-trex)"
        required
        maxLength={30}
        pattern="[a-z0-9-]+"
      />
      <input name="concept" placeholder="방의 한 줄 소개" required maxLength={60} />
      <textarea name="description" placeholder="방 설명 (선택)" maxLength={250} rows={3} />

      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
        비공개 방으로 만들기
      </label>

      {isPrivate ? <input name="passcode" placeholder="방 비밀번호 (4~20자)" required maxLength={20} /> : null}

      <button disabled={loading} type="submit">
        {loading ? "생성 중..." : "방 만들기"}
      </button>
      {error ? <p style={{ color: "#ff9292", margin: 0 }}>{error}</p> : null}
      <style jsx>{`
        input,
        textarea,
        button {
          border-radius: 12px;
          border: 1px solid rgba(149, 255, 191, 0.2);
          background: rgba(0, 0, 0, 0.3);
          color: #f4f7f6;
          padding: 11px 12px;
        }
        input[type="checkbox"] {
          width: 16px;
          height: 16px;
          margin: 0;
          padding: 0;
        }
        button {
          cursor: pointer;
          background: linear-gradient(90deg, #8df7a8 0%, #54cc7b 100%);
          color: #0d1715;
          font-weight: 700;
        }
      `}</style>
    </form>
  );
}
