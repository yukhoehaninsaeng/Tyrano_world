import { ChatShell } from "@/components/chat-shell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function HomePage() {
  return (
    <main style={{ height: "100vh" }}>
      <ChatShell />
    </main>
  );
}
