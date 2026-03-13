"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  extractTyranoNumber,
  formatTyranoName,
  getAvailableTyranoNumber
} from "@/lib/chat/nickname";
import { loadNickname, loadTheme, saveNickname, saveTheme } from "@/lib/storage";
import type { Message, Room, ThemeMode } from "@/types/database";

type PresenceState = Record<string, { nickname: string; number: number | null }[]>;
type NavTab = "open" | "private" | "feedback";

const NAV_ITEMS: { id: NavTab; icon: string; label: string }[] = [
  { id: "open", icon: "🌐", label: "오픈굴" },
  { id: "private", icon: "🔒", label: "토끼굴" },
  { id: "feedback", icon: "💌", label: "건의함" }
];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function ChatShell() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draftRoomTitle, setDraftRoomTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [sessionNickname, setSessionNickname] = useState("");
  const [presenceCount, setPresenceCount] = useState(1);
  const [status, setStatus] = useState("Add Supabase env values to enable realtime chat.");
  const [activeTab, setActiveTab] = useState<NavTab>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  const effectiveNickname = savedNickname.trim() || sessionNickname || "Generating...";
  const filteredRooms = rooms.filter((room) =>
    room.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  useEffect(() => {
    const storedTheme = loadTheme();
    const storedNickname = loadNickname();
    setTheme(storedTheme);
    setSavedNickname(storedNickname);
    setNicknameInput(storedNickname);
    document.body.dataset.theme = storedTheme;
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase as any;
    let isMounted = true;
    const roomsChannel = client.channel("public:rooms");

    async function loadRooms() {
      const { data, error } = await client.from("rooms").select("*").order("created_at", { ascending: true });
      if (!isMounted) return;
      if (error) {
        setStatus(`Failed to load rooms: ${error.message}`);
        return;
      }
      const nextRooms = (data ?? []) as Room[];
      setRooms(nextRooms);
      setActiveRoomId((current) => current || nextRooms[0]?.id || "");
    }

    void loadRooms();
    roomsChannel.on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
      void loadRooms();
    }).subscribe();

    return () => {
      isMounted = false;
      void client.removeChannel(roomsChannel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !activeRoomId) return;
    const client = supabase as any;
    let isActive = true;
    const presenceKey = `${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
    const roomChannel = client.channel(`room:${activeRoomId}`, { config: { presence: { key: presenceKey } } });

    function buildNickname(state: PresenceState) {
      if (savedNickname.trim()) return savedNickname.trim();
      const occupiedNumbers = Object.values(state).flat().map((entry) => entry.number).filter((value): value is number => value !== null);
      const availableNumber = getAvailableTyranoNumber(occupiedNumbers);
      return formatTyranoName(availableNumber);
    }

    async function loadMessages() {
      const { data, error } = await client.from("messages").select("*").eq("room_id", activeRoomId).order("created_at", { ascending: true });
      if (!isActive) return;
      if (error) return;
      setMessages((data ?? []) as Message[]);
    }

    void loadMessages();
    roomChannel.on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${activeRoomId}` }, (payload: { new: Message }) => {
      const incoming = payload.new as Message;
      setMessages((current) => current.some((m) => m.id === incoming.id) ? current : [...current, incoming]);
    }).on("presence", { event: "sync" }, () => {
      const state = roomChannel.presenceState() as PresenceState;
      const members = Object.values(state).flat();
      setPresenceCount(Math.max(members.length, 1));
      if (!savedNickname.trim()) setSessionNickname(buildNickname(state));
    }).subscribe(async (status: string) => {
      if (status !== "SUBSCRIBED") return;
      const state = roomChannel.presenceState() as PresenceState;
      const candidate = buildNickname(state);
      if (!savedNickname.trim()) setSessionNickname(candidate);
      await roomChannel.track({ nickname: candidate, number: extractTyranoNumber(candidate) });
    });

    return () => {
      isActive = false;
      setMessages([]);
      setPresenceCount(1);
      void client.removeChannel(roomChannel);
    };
  }, [supabase, activeRoomId, savedNickname]);

  async function handleCreateRoom() {
    if (!supabase || !draftRoomTitle.trim()) return;
    const client = supabase as any;
    const { data, error } = await client.from("rooms").insert({ title: draftRoomTitle.trim() }).select().single();
    if (error) return;
    setDraftRoomTitle("");
    setRooms((current) => current.some((r) => r.id === data.id) ? current : [...current, data]);
    setActiveRoomId(data.id);
  }

  async function handleSendMessage() {
    if (!supabase || !activeRoomId || !draftMessage.trim()) return;
    const client = supabase as any;
    const { error } = await client.from("messages").insert({
      room_id: activeRoomId,
      sender_name: savedNickname.trim() || sessionNickname || formatTyranoName(1),
      content: draftMessage.trim()
    });
    if (error) return;
    setDraftMessage("");
  }

  return (
    <main className="safe-screen bg-[#121212] text-white">
      <div className="flex h-screen min-h-screen flex-col md:h-[100dvh]">
        {/* Mobile Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 lg:hidden bg-[#0f0f0f]">
          <button
            type="button"
            onClick={() => setSidebarOpen((current) => !current)}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm"
          >
            Menu
          </button>
          <div className="text-sm font-bold">{activeRoom?.title ?? "티라노 월드"}</div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm"
          >
            Settings
          </button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[68px_288px_minmax(0,1fr)]">
          {/* Left NavBar - RabbitHole Style */}
          <nav className="hidden border-r border-white/5 bg-[#0f0f0f] lg:flex lg:flex-col lg:items-center lg:py-4 lg:gap-4 lg:flex-shrink-0">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/20 mb-2">
              <span className="text-sm font-black text-[var(--accent)]">TY</span>
            </div>
            
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  "ui-transition flex h-12 w-12 items-center justify-center rounded-xl text-xl",
                  activeTab === item.id
                    ? "bg-white/10 text-[var(--accent)]"
                    : "text-white/40 hover:bg-white/5"
                )}
                title={item.label}
              >
                {item.icon}
              </button>
            ))}

            <div className="mt-auto flex flex-col items-center gap-4 pb-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="ui-transition flex h-10 w-10 items-center justify-center rounded-xl text-white/40 hover:bg-white/5"
                title="설정"
              >
                ⚙️
              </button>
              <div 
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--accent)] to-orange-400 text-xs font-bold text-white cursor-pointer shadow-lg shadow-[var(--accent)]/20"
                title={effectiveNickname}
              >
                {effectiveNickname[0]}
              </div>
            </div>
          </nav>

          {/* Middle Sidebar - Room List */}
          <aside className={clsx(
            "border-r border-white/5 bg-[#121212] lg:flex lg:flex-col",
            sidebarOpen ? "flex flex-col fixed inset-0 z-50 lg:relative lg:z-0" : "hidden"
          )}>
            <div className="flex flex-col gap-4 p-5 flex-shrink-0">
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  {NAV_ITEMS.find((item) => item.id === activeTab)?.label ?? "Rooms"}
                </h1>
                <button
                  type="button"
                  onClick={() => {
                    const title = prompt("새로운 굴의 이름을 입력하세요:");
                    if (title) {
                      setDraftRoomTitle(title);
                      setTimeout(() => handleCreateRoom(), 0);
                    }
                  }}
                  className="ui-transition flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/5 text-white/50 hover:text-white"
                >
                  +
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="검색어를 입력하세요"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border-none bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-[var(--accent)]/50"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">🔍</span>
              </div>
            </div>

            <div className="scrollbar-subtle flex-1 overflow-y-auto px-2 pb-4">
              <div className="space-y-1">
                {filteredRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center opacity-30">
                    <p className="text-sm text-white">방이 없습니다</p>
                  </div>
                ) : (
                  filteredRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        setActiveRoomId(room.id);
                        setSidebarOpen(false);
                      }}
                      className={clsx(
                        "ui-transition flex w-full flex-col rounded-xl p-3 text-left",
                        activeRoomId === room.id ? "bg-white/10 ring-1 ring-white/10" : "hover:bg-white/5"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span
                          className={clsx(
                            "truncate text-[14px] font-semibold",
                            activeRoomId === room.id ? "text-[var(--accent)]" : "text-white/90"
                          )}
                        >
                          {room.title}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {formatTime(room.created_at)}
                        </span>
                      </div>
                      <div className="truncate text-[12px] text-white/50">
                        {activeRoomId === room.id ? "채팅 중..." : "최근 메시지가 없습니다"}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-white/5 bg-[#0f0f0f]/50 p-4">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-transparent px-3 py-2 text-xs font-medium">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="truncate text-white/70">{effectiveNickname}</span>
                <span className="ml-auto text-[10px] text-white/20">{presenceCount} online</span>
              </div>
            </div>
          </aside>

          {/* Main Chat Area */}
          <section className="flex min-h-0 flex-col bg-[#121212]">
            {activeRoom ? (
              <>
                <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between bg-[#121212]">
                  <div>
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                      <span className="text-[var(--accent)]">🎯</span> {activeRoom.title}
                    </h2>
                    <p className="text-xs text-white/30 mt-0.5">{presenceCount}명의 티라노가 대화 중</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="h-9 px-4 rounded-xl bg-white/5 text-xs font-bold hover:bg-white/10 transition-all">공유</button>
                    <button className="h-9 w-9 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-all">⋮</button>
                  </div>
                </header>

                <div className="scrollbar-subtle flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.map((message) => {
                    const isMe = message.sender_name === effectiveNickname;
                    return (
                      <div key={message.id} className={clsx("flex flex-col", isMe ? "items-end" : "items-start")}>
                        {!isMe && (
                          <span className="text-[11px] text-white/40 mb-1 ml-1 font-medium">{message.sender_name}</span>
                        )}
                        <div className="flex items-end gap-2">
                          {isMe && (
                            <span className="text-[10px] text-white/20 mb-1">
                              {formatTime(message.created_at)}
                            </span>
                          )}
                          <div
                            className={clsx(
                              "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] shadow-sm leading-relaxed",
                              isMe
                                ? "bg-white text-black rounded-tr-none"
                                : "bg-[#2c2c2c] text-white rounded-tl-none border border-white/5"
                            )}
                          >
                            <div className="whitespace-pre-wrap break-words">
                              {message.content}
                            </div>
                          </div>
                          {!isMe && (
                            <span className="text-[10px] text-white/20 mb-1">
                              {formatTime(message.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messageEndRef} />
                </div>

                <div className="p-4 bg-[#121212]">
                  <div className="mx-auto max-w-4xl relative group">
                    <textarea
                      placeholder="메시지를 입력하세요..."
                      value={draftMessage}
                      onChange={(e) => setDraftMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      rows={1}
                      className="w-full bg-[#1e1e1e] border border-white/10 rounded-2xl py-3.5 pl-4 pr-16 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/50 transition-all resize-none min-h-[52px] max-h-32"
                    />
                    <button
                      type="button"
                      onClick={handleSendMessage}
                      disabled={!draftMessage.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-14 rounded-xl bg-[var(--accent)] hover:opacity-90 text-white font-bold text-xs transition-all disabled:opacity-30"
                    >
                      전송
                    </button>
                  </div>
                  <p className="text-center text-[10px] text-white/20 mt-2">
                    티라노 월드에서는 모든 대화가 익명으로 보호됩니다. 건전한 대화 문화를 지향합니다. 🦖
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                  <span className="text-4xl">🦖</span>
                </div>
                <h2 className="text-2xl font-black text-white">티라노 월드에 오신 걸 환영해요</h2>
                <p className="mt-2 text-white/40">왼쪽 목록에서 대화할 굴을 선택하거나 새로운 굴을 파보세요.</p>
                <button 
                  onClick={() => {
                    const title = prompt("새로운 굴의 이름을 입력하세요:");
                    if (title) {
                      setDraftRoomTitle(title);
                      setTimeout(() => handleCreateRoom(), 0);
                    }
                  }}
                  className="mt-8 h-12 px-8 rounded-2xl bg-[var(--accent)] text-white font-bold hover:opacity-90 transition-all"
                >
                  새로운 굴 만들기
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#1e1e1e] border border-white/5 rounded-3xl shadow-2xl overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white">설정</h3>
                <button onClick={() => setSettingsOpen(false)} className="text-white/40 hover:text-white">✕</button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">닉네임 설정</label>
                  <div className="flex gap-2">
                    <input
                      value={nicknameInput}
                      onChange={(e) => setNicknameInput(e.target.value)}
                      placeholder="닉네임을 입력하세요"
                      className="flex-1 bg-white/5 border-none h-12 rounded-2xl px-4 text-white focus:ring-1 focus:ring-[var(--accent)]/50"
                    />
                    <button
                      onClick={() => {
                        handleSaveNickname();
                        setSettingsOpen(false);
                      }}
                      className="px-6 rounded-2xl bg-[var(--accent)] text-white font-bold"
                    >
                      저장
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/50 uppercase tracking-wider ml-1">테마 모드</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["dark", "light", "excel"] as ThemeMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setTheme(m)}
                        className={clsx(
                          "h-12 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all",
                          theme === m ? "bg-white text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 pt-6 border-t border-white/5 text-center">
                <p className="text-[10px] font-bold text-white/10 tracking-[0.2em] uppercase">Tyrano World v1.0</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
