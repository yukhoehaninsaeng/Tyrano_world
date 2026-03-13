"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { extractTyranoNumber, formatTyranoName, getAvailableTyranoNumber } from "@/lib/chat/nickname";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  loadJoinedRooms,
  loadNickname,
  loadTheme,
  saveJoinedRooms,
  saveNickname,
  saveTheme
} from "@/lib/storage";
import type { Message, Room, ThemeMode } from "@/types/database";

type PresenceState = Record<string, { nickname: string; number: number | null }[]>;
type NavTab = "open" | "private" | "feedback";
type RoomListTab = "open" | "secret" | "joined";

const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  excel: "Excel"
};

const NAV_ITEMS: { id: NavTab; icon: string; label: string }[] = [
  { id: "open", icon: "🌐", label: "오픈굴" },
  { id: "private", icon: "🔒", label: "토끼굴" },
  { id: "feedback", icon: "💌", label: "건의함" }
];

const ROOM_FILTERS: { id: RoomListTab; label: string }[] = [
  { id: "open", label: "오픈 채팅방" },
  { id: "secret", label: "비밀 채팅방" },
  { id: "joined", label: "참여 중" }
];

const EXCEL_COLUMNS = ["A", "B", "C", "D"];

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric"
  }).format(new Date(value));
}

export function ChatShell() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const hasSupabase = Boolean(supabase);

  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draftRoomTitle, setDraftRoomTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [sessionNickname, setSessionNickname] = useState("");
  const [presenceCount, setPresenceCount] = useState(1);
  const [status, setStatus] = useState("Supabase env를 추가하면 실시간 채팅이 연결됩니다.");
  const [activeTab, setActiveTab] = useState<NavTab>("open");
  const [roomListTab, setRoomListTab] = useState<RoomListTab>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [newRoomVisibility, setNewRoomVisibility] = useState<"open" | "secret">("open");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joinedRoomIds, setJoinedRoomIds] = useState<string[]>([]);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  const effectiveNickname = savedNickname.trim() || sessionNickname || "Generating...";
  const searchKeyword = searchQuery.trim().toLowerCase();
  const filteredRooms = rooms.filter((room) => {
    if (searchKeyword && !room.title.toLowerCase().includes(searchKeyword)) {
      return false;
    }
    if (roomListTab === "open") {
      return room.visibility === "open";
    }
    if (roomListTab === "secret") {
      return room.visibility === "secret";
    }
    return joinedRoomIds.includes(room.id);
  });
  const joinableRooms = rooms.filter((room) => !joinedRoomIds.includes(room.id));

  useEffect(() => {
    const storedTheme = loadTheme();
    const storedNickname = loadNickname();
    setTheme(storedTheme);
    setSavedNickname(storedNickname);
    setNicknameInput(storedNickname);
    setJoinedRoomIds(loadJoinedRooms());
    document.body.dataset.theme = storedTheme;
  }, []);

  useEffect(() => {
    document.body.dataset.theme = theme;
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function markRoomAsJoined(roomId: string) {
    setJoinedRoomIds((current) => {
      if (current.includes(roomId)) {
        return current;
      }
      const next = [...current, roomId];
      saveJoinedRooms(next);
      return next;
    });
  }

  useEffect(() => {
    if (!supabase) {
      return;
    }

    const client = supabase as any;
    let isMounted = true;
    const roomsChannel = client.channel("public:rooms");

    async function loadRooms() {
      setStatus("방 목록 불러오는 중...");
      const { data, error } = await client.from("rooms").select("*").order("created_at", { ascending: true });
      if (!isMounted) {
        return;
      }
      if (error) {
        setStatus(`방 목록을 불러오지 못했습니다: ${error.message}`);
        return;
      }

      const normalizedRooms: Room[] = ((data ?? []) as Partial<Room>[]).map((room) => ({
        id: room.id ?? "",
        title: room.title ?? "이름 없는 방",
        visibility: room.visibility === "secret" ? "secret" : "open",
        created_at: room.created_at ?? new Date().toISOString()
      }));

      setRooms(normalizedRooms);
      setActiveRoomId((current) => current || normalizedRooms[0]?.id || "");
      setStatus("실시간 연결됨");
    }

    void loadRooms();
    roomsChannel
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
        void loadRooms();
      })
      .subscribe();

    return () => {
      isMounted = false;
      void client.removeChannel(roomsChannel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !activeRoomId) {
      return;
    }

    const client = supabase as any;
    let isActive = true;
    const presenceKey = `${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
    const roomChannel = client.channel(`room:${activeRoomId}`, {
      config: { presence: { key: presenceKey } }
    });

    function buildNickname(state: PresenceState) {
      if (savedNickname.trim()) {
        return savedNickname.trim();
      }
      const occupiedNumbers = Object.values(state)
        .flat()
        .map((entry) => entry.number)
        .filter((value): value is number => value !== null);
      return formatTyranoName(getAvailableTyranoNumber(occupiedNumbers));
    }

    async function loadMessages() {
      const { data, error } = await client
        .from("messages")
        .select("*")
        .eq("room_id", activeRoomId)
        .order("created_at", { ascending: true });

      if (!isActive) {
        return;
      }
      if (error) {
        setStatus(`메시지를 불러오지 못했습니다: ${error.message}`);
        return;
      }
      setMessages((data ?? []) as Message[]);
    }

    void loadMessages();
    roomChannel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${activeRoomId}` },
        (payload: { new: Message }) => {
          const incoming = payload.new;
          setMessages((current) => current.some((message) => message.id === incoming.id) ? current : [...current, incoming]);
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = roomChannel.presenceState() as PresenceState;
        const members = Object.values(state).flat();
        setPresenceCount(Math.max(members.length, 1));
        if (!savedNickname.trim()) {
          setSessionNickname(buildNickname(state));
        }
      })
      .subscribe(async (subscriptionStatus: string) => {
        if (subscriptionStatus !== "SUBSCRIBED") {
          return;
        }
        const state = roomChannel.presenceState() as PresenceState;
        const candidate = buildNickname(state);
        if (!savedNickname.trim()) {
          setSessionNickname(candidate);
        }
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
    if (!supabase || !draftRoomTitle.trim()) {
      return;
    }

    const client = supabase as any;
    const { data, error } = await client
      .from("rooms")
      .insert({ title: draftRoomTitle.trim(), visibility: newRoomVisibility })
      .select()
      .single();

    if (error) {
      setStatus(`방을 만들지 못했습니다: ${error.message}`);
      return;
    }

    const createdRoom: Room = {
      id: data.id,
      title: data.title,
      visibility: data.visibility === "secret" ? "secret" : "open",
      created_at: data.created_at
    };

    setDraftRoomTitle("");
    setRooms((current) => current.some((room) => room.id === createdRoom.id) ? current : [...current, createdRoom]);
    setActiveRoomId(createdRoom.id);
    setRoomListTab("joined");
    markRoomAsJoined(createdRoom.id);
    setJoinDialogOpen(false);
    setSidebarOpen(false);
    setStatus("새 방이 생성되었습니다.");
  }

  function handleJoinRoom(roomId: string) {
    setActiveRoomId(roomId);
    markRoomAsJoined(roomId);
    setJoinDialogOpen(false);
    setSidebarOpen(false);
    setRoomListTab("joined");
    setStatus("방에 참여했습니다.");
  }

  function handleJoinRoomByCode() {
    const room = rooms.find((item) => item.id === joinRoomCode.trim());
    if (!room) {
      setStatus("입력한 Room ID를 찾지 못했습니다.");
      return;
    }
    handleJoinRoom(room.id);
    setJoinRoomCode("");
  }

  async function handleSendMessage() {
    if (!supabase || !activeRoomId || !draftMessage.trim()) {
      return;
    }

    const client = supabase as any;
    const { error } = await client.from("messages").insert({
      room_id: activeRoomId,
      sender_name: savedNickname.trim() || sessionNickname || formatTyranoName(1),
      content: draftMessage.trim()
    });

    if (error) {
      setStatus(`메시지를 보내지 못했습니다: ${error.message}`);
      return;
    }

    markRoomAsJoined(activeRoomId);
    setDraftMessage("");
  }

  function handleSaveNickname() {
    const nextNickname = nicknameInput.trim();
    setSavedNickname(nextNickname);
    saveNickname(nextNickname);
  }

  const currentSectionLabel =
    activeTab === "open" ? "오픈굴" : activeTab === "private" ? "토끼굴" : "건의함";

  return (
    <main className="safe-screen bg-[var(--background)] text-white">
      <div className="flex h-screen min-h-screen flex-col md:h-[100dvh]">
        <div className="flex items-center justify-between border-b border-white/5 bg-[var(--sidebar)] px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((current) => !current)}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm"
          >
            Menu
          </button>
          <div className="text-sm font-bold">{activeRoom?.title ?? "Tyrano World"}</div>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="rounded-xl bg-white/5 px-4 py-2 text-sm"
          >
            Settings
          </button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[68px_320px_minmax(0,1fr)]">
          <nav className="hidden border-r border-white/5 bg-[var(--sidebar)] lg:flex lg:flex-col lg:items-center lg:gap-4 lg:py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)]/20">
              <span className="text-sm font-black text-[var(--accent)]">TY</span>
            </div>

            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={clsx(
                  "ui-transition flex h-12 w-12 items-center justify-center rounded-xl text-xl",
                  activeTab === item.id ? "bg-white/10 text-[var(--accent)]" : "text-white/40 hover:bg-white/5"
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
                ⚙
              </button>
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-[var(--accent)] to-orange-400 text-xs font-bold text-white shadow-lg shadow-[var(--accent)]/20"
                title={effectiveNickname}
              >
                {effectiveNickname.slice(0, 1)}
              </div>
            </div>
          </nav>

          <aside
            className={clsx(
              "border-r border-white/5 bg-[var(--background)] lg:flex lg:flex-col",
              sidebarOpen ? "fixed inset-0 z-50 flex flex-col lg:relative lg:z-0" : "hidden"
            )}
          >
            <div className="flex flex-col gap-4 border-b border-white/5 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/30">{currentSectionLabel}</p>
                  <h1 className="mt-1 text-lg font-bold text-white">{currentSectionLabel} 목록</h1>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setJoinDialogOpen(true)}
                    className="ui-transition flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-lg text-white/70 hover:bg-white/10"
                    aria-label="방 추가"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="ui-transition flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-sm text-white/70 hover:bg-white/10 lg:hidden"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="방 검색"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full rounded-xl border-none bg-white/5 py-2.5 pl-9 pr-4 text-sm text-white placeholder:text-white/20 focus:ring-1 focus:ring-[var(--accent)]/50"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20">🔍</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {ROOM_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setRoomListTab(filter.id)}
                    className={clsx(
                      "rounded-xl px-3 py-2 text-xs font-medium transition-all",
                      roomListTab === filter.id ? "bg-white text-black" : "bg-white/5 text-white/60 hover:bg-white/10"
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="scrollbar-subtle flex-1 overflow-y-auto px-2 py-4">
              <div className="space-y-1">
                {filteredRooms.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-8 text-center text-sm text-white/40">
                    현재 조건에 맞는 방이 없습니다.
                  </div>
                ) : (
                  filteredRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        setActiveRoomId(room.id);
                        markRoomAsJoined(room.id);
                        setSidebarOpen(false);
                      }}
                      className={clsx(
                        "ui-transition flex w-full flex-col rounded-xl p-3 text-left",
                        activeRoomId === room.id ? "bg-white/10 ring-1 ring-white/10" : "hover:bg-white/5"
                      )}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span
                          className={clsx(
                            "truncate text-[14px] font-semibold",
                            activeRoomId === room.id ? "text-[var(--accent)]" : "text-white/90"
                          )}
                        >
                          {room.title}
                        </span>
                        <span className="text-[10px] text-white/30">{formatDate(room.created_at)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[12px] text-white/45">
                        <span>{room.visibility === "secret" ? "비밀방" : "오픈방"}</span>
                        <span>{activeRoomId === room.id ? "채팅 중" : room.id.slice(0, 8)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-white/5 bg-[var(--sidebar)]/80 p-4">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="truncate text-white/70">{effectiveNickname}</span>
                <span className="ml-auto text-[10px] text-white/20">{presenceCount} online</span>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-[var(--background)]">
            <header className="border-b border-white/5 bg-[var(--background)] px-6 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    <span className="text-[var(--accent)]">🎯</span>
                    {activeRoom?.title ?? "방을 선택해 주세요"}
                  </h2>
                  <p className="mt-1 text-xs text-white/30">
                    {activeRoom ? `${presenceCount}명의 티라노가 대화 중` : "왼쪽에서 방을 선택하거나 새로 만들어 보세요."}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/50">
                    Theme {THEME_LABELS[theme]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="rounded-xl bg-white/5 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/10"
                  >
                    설정
                  </button>
                </div>
              </div>
            </header>

            {activeRoom ? (
              <>
                <div
                  className={clsx(
                    "scrollbar-subtle flex-1 overflow-y-auto p-4 md:p-6",
                    theme === "excel" && "bg-grid bg-[size:56px_56px]"
                  )}
                >
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    {messages.length === 0 ? (
                      <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-6 py-10 text-center text-sm text-white/40">
                        아직 메시지가 없습니다. 첫 메시지를 남겨보세요.
                      </div>
                    ) : theme === "excel" ? (
                      messages.map((message, index) => (
                        <article key={message.id} className="overflow-hidden rounded-xl bg-white shadow-sm">
                          <div className="grid grid-cols-[72px_1.2fr_2fr_96px] border border-[#c9d7c8] text-sm">
                            {EXCEL_COLUMNS.map((column, cellIndex) => (
                              <div
                                key={`${message.id}-${column}`}
                                className={clsx(
                                  "border-b border-r border-[#c9d7c8] bg-[#f3f8f1] px-3 py-2 font-medium text-[#3e5f45]",
                                  cellIndex === EXCEL_COLUMNS.length - 1 && "border-r-0"
                                )}
                              >
                                {column}
                              </div>
                            ))}
                            <div className="border-r border-[#c9d7c8] px-3 py-3 text-[#55705d]">{index + 1}</div>
                            <div className="border-r border-[#c9d7c8] px-3 py-3 font-medium text-[#17311d]">{message.sender_name}</div>
                            <div className="border-r border-[#c9d7c8] px-3 py-3 text-[#17311d]">{message.content}</div>
                            <div className="px-3 py-3 text-right text-[#55705d]">{formatTime(message.created_at)}</div>
                          </div>
                        </article>
                      ))
                    ) : (
                      messages.map((message) => {
                        const isOwnMessage = message.sender_name === effectiveNickname;
                        return (
                          <article
                            key={message.id}
                            className={clsx("flex", isOwnMessage ? "justify-end" : "justify-start")}
                          >
                            <div className="max-w-[85%]">
                              <div className="mb-1 px-1 text-[10px] text-white/30">
                                {message.sender_name} · {formatTime(message.created_at)}
                              </div>
                              <div
                                className={clsx(
                                  "rounded-2xl px-4 py-2.5 text-[14px] shadow-sm",
                                  isOwnMessage
                                    ? "rounded-tr-none bg-white text-black"
                                    : "rounded-tl-none border border-white/5 bg-[#2c2c2c] text-white"
                                )}
                              >
                                <div className="whitespace-pre-wrap break-words">{message.content}</div>
                              </div>
                            </div>
                          </article>
                        );
                      })
                    )}
                    <div ref={messageEndRef} />
                  </div>
                </div>

                <footer className="border-t border-white/5 px-4 py-4 md:px-6">
                  <div className="mx-auto max-w-5xl">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-white/30">
                        {hasSupabase ? "영구 저장 및 실시간 동기화 활성화됨" : "Supabase 설정 대기 중"}
                      </div>
                      <div className="text-xs text-white/30">{status}</div>
                    </div>
                    <div className="relative">
                      <textarea
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        placeholder="메시지를 입력하세요..."
                        rows={theme === "excel" ? 3 : 2}
                        disabled={!hasSupabase}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey && theme !== "excel") {
                            event.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                        className="min-h-[52px] max-h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/5 py-3.5 pl-4 pr-20 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                      <button
                        type="button"
                        onClick={() => void handleSendMessage()}
                        disabled={!hasSupabase || !draftMessage.trim()}
                        className="absolute right-2 top-1/2 h-9 w-14 -translate-y-1/2 rounded-xl bg-[var(--accent)] text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        전송
                      </button>
                    </div>
                  </div>
                </footer>
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5">
                  <span className="text-4xl">🦖</span>
                </div>
                <h2 className="text-2xl font-black text-white">티라노 월드에 오신 걸 환영해요</h2>
                <p className="mt-2 text-white/40">왼쪽 목록에서 대화할 굴을 선택하거나 새로운 굴을 열어보세요.</p>
                <button
                  type="button"
                  onClick={() => setJoinDialogOpen(true)}
                  className="mt-8 h-12 rounded-2xl bg-[var(--accent)] px-8 font-bold text-white hover:opacity-90"
                >
                  새로운 굴 만들기
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/5 bg-[#1e1e1e] shadow-2xl">
            <div className="p-8">
              <div className="mb-8 flex items-center justify-between">
                <h3 className="text-xl font-black text-white">설정</h3>
                <button type="button" onClick={() => setSettingsOpen(false)} className="text-white/40 hover:text-white">
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="ml-1 text-xs font-bold uppercase tracking-wider text-white/50">닉네임 설정</label>
                  <div className="flex gap-2">
                    <input
                      value={nicknameInput}
                      onChange={(event) => setNicknameInput(event.target.value)}
                      placeholder={effectiveNickname}
                      className="h-12 flex-1 rounded-2xl border-none bg-white/5 px-4 text-white focus:ring-1 focus:ring-[var(--accent)]/50"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        handleSaveNickname();
                        setSettingsOpen(false);
                      }}
                      className="rounded-2xl bg-[var(--accent)] px-6 font-bold text-white"
                    >
                      저장
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="ml-1 text-xs font-bold uppercase tracking-wider text-white/50">테마 모드</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.keys(THEME_LABELS) as ThemeMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setTheme(mode)}
                        className={clsx(
                          "h-12 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all",
                          theme === mode ? "bg-white text-black" : "bg-white/5 text-white/40 hover:bg-white/10"
                        )}
                      >
                        {THEME_LABELS[mode]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 border-t border-white/5 pt-6 text-center">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/10">Tyrano World v1.0</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {joinDialogOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#1a1a1a] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-white/50">Joined rooms</p>
                <h3 className="mt-2 text-2xl font-bold text-white">방 만들기 / 방 참여하기</h3>
              </div>
              <button
                type="button"
                onClick={() => setJoinDialogOpen(false)}
                className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white/50">Create room</p>
                <input
                  value={draftRoomTitle}
                  onChange={(event) => setDraftRoomTitle(event.target.value)}
                  placeholder="Room title"
                  className="mt-4 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewRoomVisibility("open")}
                    className={clsx(
                      "rounded-xl border px-3 py-3 text-sm",
                      newRoomVisibility === "open"
                        ? "border-transparent bg-[var(--accent)] text-white"
                        : "border-white/10 text-white/70 hover:bg-white/5"
                    )}
                  >
                    Open room
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRoomVisibility("secret")}
                    className={clsx(
                      "rounded-xl border px-3 py-3 text-sm",
                      newRoomVisibility === "secret"
                        ? "border-transparent bg-[var(--accent)] text-white"
                        : "border-white/10 text-white/70 hover:bg-white/5"
                    )}
                  >
                    Secret room
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCreateRoom()}
                  disabled={!hasSupabase}
                  className="mt-3 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create now
                </button>
              </div>

              <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-white/50">Join room</p>
                <div className="mt-4 flex gap-2">
                  <input
                    value={joinRoomCode}
                    onChange={(event) => setJoinRoomCode(event.target.value)}
                    placeholder="Room ID"
                    className="h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50"
                  />
                  <button
                    type="button"
                    onClick={handleJoinRoomByCode}
                    className="rounded-2xl border border-white/10 px-4 text-sm text-white/80 hover:bg-white/5"
                  >
                    Join
                  </button>
                </div>

                <div className="scrollbar-subtle mt-4 max-h-56 overflow-y-auto pr-1">
                  <div className="flex flex-col gap-2">
                    {joinableRooms.length === 0 ? (
                      <div className="rounded-2xl border border-white/5 px-4 py-4 text-sm text-white/40">
                        참여 가능한 방이 없습니다.
                      </div>
                    ) : (
                      joinableRooms.map((room) => (
                        <button
                          key={room.id}
                          type="button"
                          onClick={() => handleJoinRoom(room.id)}
                          className="rounded-2xl border border-white/5 px-4 py-4 text-left hover:bg-white/5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-white">{room.title}</span>
                            <span className="text-[10px] text-white/30">
                              {room.visibility === "secret" ? "Secret" : "Open"}
                            </span>
                          </div>
                          <div className="mt-2 text-[10px] text-white/30">{room.id}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
