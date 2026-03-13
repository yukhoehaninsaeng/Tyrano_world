"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { extractTyranoNumber, formatTyranoName, getAvailableTyranoNumber } from "@/lib/chat/nickname";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  loadJoinedRooms,
  loadLayout,
  loadNickname,
  loadRoomPasswords,
  loadTheme,
  saveJoinedRooms,
  saveLayout,
  saveNickname,
  saveRoomPassword,
  saveTheme
} from "@/lib/storage";
import type { LayoutMode, Message, Room, ThemeMode } from "@/types/database";

type PresenceState = Record<string, { nickname: string; number: number | null }[]>;
type NavTab = "open" | "private" | "feedback";
type RoomListTab = "open" | "secret" | "joined";

const NAV_ITEMS: { id: NavTab; icon: string; label: string }[] = [
  { id: "open", icon: "O", label: "Open" },
  { id: "private", icon: "P", label: "Private" },
  { id: "feedback", icon: "F", label: "Feedback" }
];

const ROOM_FILTERS: { id: RoomListTab; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "secret", label: "Secret" },
  { id: "joined", label: "Joined" }
];

const CATEGORY_ITEMS: { id: NavTab; icon: string; label: string }[] = [
  { id: "open", icon: "🌐", label: "오픈굴" },
  { id: "private", icon: "🔒", label: "비밀굴" },
  { id: "feedback", icon: "💌", label: "건의함" }
];

const LAYOUT_ITEMS: { id: LayoutMode; label: string; description: string }[] = [
  { id: "default", label: "General", description: "Bubble chat layout" },
  { id: "excel", label: "Excel", description: "Spreadsheet style" },
  { id: "notepad", label: "Notepad", description: "Editor style log" }
];

const EXCEL_COLUMNS = ["A", "B", "C", "D", "E", "F"];

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

function getInitials(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "T";
}

function DinoMark() {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" className="h-12 w-12">
      <path d="M37 26c8-9 16-13 24-13 10 0 19 5 27 16 13 3 21 14 21 28 0 22-18 39-41 39H50C26 96 11 79 11 57c0-15 9-27 26-31Z" fill="#8CCF43" stroke="#18341C" strokeWidth="4" strokeLinejoin="round" />
      <path d="M54 16c4 3 8 7 10 12H43c3-5 7-9 11-12Z" fill="#57A536" />
      <ellipse cx="37" cy="50" rx="10" ry="13" fill="#1C1C1C" />
      <ellipse cx="81" cy="50" rx="10" ry="13" fill="#1C1C1C" />
      <circle cx="34" cy="46" r="4" fill="#fff" />
      <circle cx="78" cy="46" r="4" fill="#fff" />
      <circle cx="49" cy="58" r="2.7" fill="#18341C" />
      <circle cx="69" cy="58" r="2.7" fill="#18341C" />
      <circle cx="59" cy="62" r="2.5" fill="#18341C" />
      <path d="M42 69c5 10 12 15 19 15 8 0 15-5 20-15-6-3-13-5-20-5-6 0-13 2-19 5Z" fill="#FE8B73" />
      <path d="M45 70c5 5 10 8 16 8 7 0 12-3 17-8" fill="none" stroke="#18341C" strokeWidth="4" strokeLinecap="round" />
      <path d="M47 69l7 8" fill="none" stroke="#18341C" strokeWidth="3" strokeLinecap="round" />
      <path d="M73 69l-7 8" fill="none" stroke="#18341C" strokeWidth="3" strokeLinecap="round" />
      <path d="M43 74l8 7" fill="#fff7d9" />
      <path d="M69 81l8-7" fill="#fff7d9" />
      <path d="M39 84c0 13 8 23 21 23 12 0 20-10 20-23H39Z" fill="#F8F0CD" />
      <circle cx="24" cy="67" r="8" fill="#FFB096" />
      <circle cx="94" cy="67" r="8" fill="#FFB096" />
      <path d="M40 90c-4 4-9 6-15 6-6 0-10-1-14-4 4 10 12 16 21 16h11c-3-4-4-11-3-18Z" fill="#8CCF43" stroke="#18341C" strokeWidth="4" strokeLinejoin="round" />
      <path d="M80 90c4 4 9 6 15 6 6 0 10-1 14-4-4 10-12 16-21 16H77c3-4 4-11 3-18Z" fill="#8CCF43" stroke="#18341C" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

export function ChatShell() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const hasSupabase = Boolean(supabase);

  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [layout, setLayout] = useState<LayoutMode>("default");
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draftRoomTitle, setDraftRoomTitle] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [nicknameInput, setNicknameInput] = useState("");
  const [savedNickname, setSavedNickname] = useState("");
  const [sessionNickname, setSessionNickname] = useState("");
  const [presenceCount, setPresenceCount] = useState(1);
  const [status, setStatus] = useState("Add Supabase env to enable realtime chat.");
  const [activeTab, setActiveTab] = useState<NavTab>("open");
  const [roomListTab, setRoomListTab] = useState<RoomListTab>("open");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [newRoomVisibility, setNewRoomVisibility] = useState<"open" | "secret">("open");
  const [newRoomPasswordEnabled, setNewRoomPasswordEnabled] = useState(false);
  const [newRoomPassword, setNewRoomPassword] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [joinRoomPassword, setJoinRoomPassword] = useState("");
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
  const myRooms = rooms.filter((room) => {
    if (!joinedRoomIds.includes(room.id)) {
      return false;
    }
    if (searchKeyword && !room.title.toLowerCase().includes(searchKeyword)) {
      return false;
    }
    if (activeTab === "open") {
      return room.visibility === "open";
    }
    if (activeTab === "private") {
      return room.visibility === "secret";
    }
    return true;
  });
  const currentSectionLabel =
    activeTab === "open" ? "Open" : activeTab === "private" ? "Private" : "Feedback";

  useEffect(() => {
    const storedTheme = loadTheme();
    const storedLayout = loadLayout();
    const storedNickname = loadNickname();
    setTheme(storedTheme);
    setLayout(storedLayout);
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
    saveLayout(layout);
  }, [layout]);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
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
      setStatus("Loading rooms...");
      const { data, error } = await client.from("rooms").select("*").order("created_at", { ascending: true });
      if (!isMounted) {
        return;
      }
      if (error) {
        setStatus(`Failed to load rooms: ${error.message}`);
        return;
      }

      const normalizedRooms: Room[] = ((data ?? []) as Partial<Room>[]).map((room) => ({
        id: room.id ?? "",
        title: room.title ?? "Untitled room",
        visibility: room.visibility === "secret" ? "secret" : "open",
        created_at: room.created_at ?? new Date().toISOString()
      }));

      setRooms(normalizedRooms);
      setActiveRoomId((current) => current || normalizedRooms[0]?.id || "");
      setStatus("Realtime connected.");
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
        setStatus(`Failed to load messages: ${error.message}`);
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
      setStatus(`Failed to create room: ${error.message}`);
      return;
    }

    const createdRoom: Room = {
      id: data.id,
      title: data.title,
      visibility: data.visibility === "secret" ? "secret" : "open",
      created_at: data.created_at
    };

    setDraftRoomTitle("");
    setNewRoomPassword("");
    setNewRoomPasswordEnabled(false);
    setRooms((current) => current.some((room) => room.id === createdRoom.id) ? current : [...current, createdRoom]);
    setActiveRoomId(createdRoom.id);
    setRoomListTab("joined");
    markRoomAsJoined(createdRoom.id);
    if (newRoomPasswordEnabled && newRoomPassword.trim()) {
      saveRoomPassword(createdRoom.id, newRoomPassword.trim());
    }
    setJoinDialogOpen(false);
    setSidebarOpen(false);
    setStatus("Room created.");
  }

  function handleJoinRoom(roomId: string) {
    const roomPasswords = loadRoomPasswords();
    const expectedPassword = roomPasswords[roomId];
    if (expectedPassword && joinRoomPassword.trim() !== expectedPassword) {
      setStatus("This room requires the correct password.");
      return;
    }
    setActiveRoomId(roomId);
    markRoomAsJoined(roomId);
    setJoinDialogOpen(false);
    setSidebarOpen(false);
    setRoomListTab("joined");
    setJoinRoomPassword("");
    setStatus("Joined room.");
  }

  function handleJoinRoomByCode() {
    const room = rooms.find((item) => item.id === joinRoomCode.trim());
    if (!room) {
      setStatus("Room ID not found.");
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
      setStatus(`Failed to send message: ${error.message}`);
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

  function toggleTheme() {
    setTheme((current) => current === "dark" ? "light" : "dark");
  }

  useEffect(() => {
    setNewRoomVisibility(newRoomPasswordEnabled ? "secret" : "open");
  }, [newRoomPasswordEnabled]);

  return (
    <main className="safe-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="flex h-screen min-h-screen flex-col md:h-[100dvh]">
        <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--sidebar)] px-4 py-3 lg:hidden">
          <button type="button" onClick={() => setSidebarOpen((current) => !current)} className="rounded-xl bg-white/5 px-4 py-2 text-sm">
            Menu
          </button>
          <div className="text-sm font-bold">{activeRoom?.title ?? "Tyrano World"}</div>
          <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-xl bg-white/5 px-4 py-2 text-sm">
            Settings
          </button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside
            className={clsx(
              "border-r border-[var(--border)] bg-[var(--background)] lg:flex lg:flex-col",
              sidebarOpen ? "fixed inset-0 z-50 flex flex-col lg:relative lg:z-0" : "hidden"
            )}
          >
            <div className="border-b border-[var(--border)] px-5 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DinoMark />
                  <div className="text-[26px] font-black tracking-tight text-white">티라노 놀이터</div>
                </div>
                <div className="flex items-center gap-4 text-xl">
                  <span title="Notifications">🔔</span>
                  <span className="h-3 w-3 rounded-full bg-[#1dd75f]" />
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(true)}
                    className="text-[var(--muted)] transition-all hover:text-[var(--foreground)]"
                    title="Settings"
                  >
                    ⚙️
                  </button>
                </div>
              </div>
            </div>

            <div className="border-b border-[var(--border)] px-5 py-6">
              <div className="text-[15px] font-medium text-[var(--muted)]">카테고리</div>
            </div>

            <div className="border-b border-[var(--border)] py-3">
              {CATEGORY_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    "flex w-full items-center gap-4 px-5 py-5 text-left transition-all",
                    activeTab === item.id ? "bg-white/10 text-white" : "text-[var(--muted)] hover:bg-white/5"
                  )}
                >
                  <span className="text-[28px] leading-none">{item.icon}</span>
                  <span className="text-[20px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>

            <div className="border-b border-[var(--border)] px-5 py-6">
              <div className="flex items-center justify-between">
                <div className="text-[15px] font-medium text-[var(--muted)]">내 굴 목록</div>
                <button type="button" onClick={() => setJoinDialogOpen(true)} className="text-3xl leading-none text-[var(--muted)] transition-all hover:text-white">
                  +
                </button>
              </div>
              <div className="relative mt-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="내 굴 검색"
                  className="w-full rounded-xl border border-transparent bg-white/5 py-2.5 pl-9 pr-4 text-sm placeholder:text-[var(--muted)] focus:border-[var(--border)] focus:outline-none"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">⌕</span>
              </div>
            </div>

            <div className="scrollbar-subtle flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-4">
                {myRooms.length === 0 ? (
                  <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-4 py-8 text-center text-sm text-[var(--muted)]">
                    참여한 방이 없습니다.
                  </div>
                ) : (
                  myRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => {
                        setActiveRoomId(room.id);
                        markRoomAsJoined(room.id);
                        setSidebarOpen(false);
                      }}
                      className={clsx(
                        "block w-full rounded-2xl px-1 py-1 text-left transition-all",
                        activeRoomId === room.id ? "bg-white/[0.04]" : "hover:bg-white/[0.03]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-2">
                            <span className={clsx("truncate text-[18px] font-black", activeRoomId === room.id ? "text-white" : "text-[#efe7dc]")}>
                              {room.title}
                            </span>
                            <span className="text-sm font-semibold text-[var(--muted)]">
                              {room.visibility === "secret" ? "비밀" : "공개"}
                            </span>
                          </div>
                          <div className="mt-2 inline-flex max-w-full items-center rounded-xl bg-white/5 px-3 py-2 text-sm font-semibold text-[#b8a48c]">
                            ✨ 참여 중인 굴
                          </div>
                          <div className="mt-3 truncate text-[15px] text-[#6f685d]">
                            {activeRoomId === room.id ? "현재 대화 중입니다." : `생성일 ${formatDate(room.created_at)}`}
                          </div>
                        </div>
                        <span className="pt-1 text-2xl">{activeRoomId === room.id ? "🔔" : "⋯"}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="mt-auto border-t border-[var(--border)] px-4 py-5">
              <div className="flex flex-col items-start gap-4">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className={clsx(
                    "relative flex h-14 w-28 items-center rounded-full border px-1.5 transition-all",
                    theme === "light" ? "border-[#efc66e] bg-[#f0cf8a]" : "border-[#33405f] bg-[#1f2940]"
                  )}
                  title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label="Toggle light and dark mode"
                >
                  <span className="absolute left-3 text-lg">☀️</span>
                  <span className="absolute right-3 text-lg">🌙</span>
                  <span
                    className={clsx(
                      "relative z-10 h-11 w-11 rounded-full bg-white shadow transition-transform",
                      theme === "light" ? "translate-x-0" : "translate-x-[52px]"
                    )}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border)] bg-white/5 text-2xl text-[var(--muted)] transition-all hover:bg-white/10"
                  title="Settings"
                >
                  ⚙️
                </button>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[var(--border)] px-4 py-4 text-sm">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-2xl font-black text-white">
                  {getInitials(effectiveNickname)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded-full bg-[#1dd75f]" />
                    <span className="truncate text-xl font-semibold">{effectiveNickname}</span>
                  </div>
                  <div className="mt-2 text-right text-[12px] text-[var(--muted)]">{presenceCount} online</div>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-[var(--background)]">
            <header className="border-b border-[var(--border)] px-6 py-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-bold">{activeRoom?.title ?? "Choose a room"}</h2>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {activeRoom ? `${presenceCount} dinos in the room` : "Pick a room or create a new one."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
                    Layout {LAYOUT_ITEMS.find((item) => item.id === layout)?.label}
                  </span>
                  <button type="button" onClick={() => setSettingsOpen(true)} className="rounded-xl bg-white/5 px-3 py-2 text-xs">
                    Layouts
                  </button>
                </div>
              </div>
            </header>

            {!activeRoom ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 text-4xl">T</div>
                <h2 className="text-2xl font-black">Welcome to Tyrano World</h2>
                <p className="mt-2 text-[var(--muted)]">Open a room from the left sidebar or create a new one.</p>
                <button type="button" onClick={() => setJoinDialogOpen(true)} className="mt-8 rounded-2xl bg-[var(--accent)] px-8 py-3 font-bold text-white">
                  Create room
                </button>
              </div>
            ) : layout === "excel" ? (
              <>
                <div className="border-b border-[var(--border)] bg-[#217346] px-4 py-3 text-white">
                  <div className="flex items-center gap-5 text-sm font-bold">
                    <span>SpreadChat</span>
                    <span className="rounded bg-white/15 px-3 py-1 text-xs">Home</span>
                    <span className="text-xs text-white/80">Review</span>
                    <span className="text-xs text-white/80">View</span>
                    <span className="ml-auto text-xs">{presenceCount} online</span>
                  </div>
                </div>
                <div className="flex items-center border-b border-[#d0d0d0] bg-[#fcfcfc]">
                  <div className="w-16 border-r border-[#d0d0d0] px-3 py-2 text-center text-xs font-bold text-[#444]">D1</div>
                  <div className="border-r border-[#d0d0d0] px-3 py-2 text-xs italic text-[#217346]">fx</div>
                  <div className="px-3 py-2 text-xs text-[#555]">{draftMessage || activeRoom.title}</div>
                </div>
                <div className="flex min-h-0 flex-1 overflow-hidden bg-[#ffffff] text-[#17311d]">
                  <div className="w-12 border-r border-[#d0d0d0] bg-[#f3f3f3]">
                    <div className="h-8 border-b border-[#d0d0d0]" />
                    {messages.map((message, index) => (
                      <div key={message.id} className="flex h-10 items-center justify-end border-b border-[#e1e1e1] pr-2 text-[10px] text-[#666]">
                        {index + 1}
                      </div>
                    ))}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <div className="grid grid-cols-[46px_100px_82px_minmax(0,1fr)_86px_64px] border-b-2 border-[#d0d0d0] bg-[#f2f2f2] text-[11px] font-semibold text-[#444]">
                      {EXCEL_COLUMNS.map((column) => (
                        <div key={column} className="border-r border-[#d0d0d0] px-3 py-2 last:border-r-0">{column}</div>
                      ))}
                    </div>
                    <div className="scrollbar-subtle flex-1 overflow-y-auto">
                      {messages.length === 0 ? (
                        <div className="p-8 text-center text-sm text-[#666]">No rows yet.</div>
                      ) : (
                        messages.map((message, index) => (
                          <div key={message.id} className={clsx("grid grid-cols-[46px_100px_82px_minmax(0,1fr)_86px_64px] border-b border-[#e1e1e1] text-[11px]", index % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
                            <div className="border-r border-[#e1e1e1] px-3 py-3 text-center">{message.sender_name === effectiveNickname ? "●" : "○"}</div>
                            <div className="border-r border-[#e1e1e1] px-3 py-3 font-bold">{message.sender_name}</div>
                            <div className="border-r border-[#e1e1e1] px-3 py-3 text-[#666]">{formatTime(message.created_at)}</div>
                            <div className="border-r border-[#e1e1e1] px-3 py-3">{message.content}</div>
                            <div className="border-r border-[#e1e1e1] px-3 py-3 text-center">{message.sender_name === effectiveNickname ? "Mine" : "Read"}</div>
                            <div className="px-3 py-3 text-center text-[#666]">{index + 1}</div>
                          </div>
                        ))
                      )}
                      <div ref={messageEndRef} />
                    </div>
                  </div>
                </div>
                <div className="border-t-2 border-[#217346] bg-white p-3">
                  <div className="flex gap-2">
                    <div className="flex w-28 items-center justify-center rounded-lg border border-[#d0d0d0] bg-[#f7f7f7] text-xs font-bold text-[#1b5e20]">
                      {effectiveNickname}
                    </div>
                    <input
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder="Type a spreadsheet row..."
                      className="min-w-0 flex-1 rounded-lg border border-[#1565c0] px-3 py-2 text-sm text-[#17311d] outline-none"
                    />
                    <button type="button" onClick={() => void handleSendMessage()} disabled={!hasSupabase || !draftMessage.trim()} className="rounded-lg bg-[#217346] px-5 text-sm font-bold text-white disabled:opacity-40">
                      Send
                    </button>
                  </div>
                </div>
              </>
            ) : layout === "notepad" ? (
              <>
                <div className="border-b border-[#b6b1a7] bg-[#ddd7cd] px-3 py-1 text-xs text-[#3b342d]">* {activeRoom.title} - TyranoPad</div>
                <div className="border-b border-[#c9c3b9] bg-[#ece7df] px-3 py-1 text-[11px] text-[#4d443b]">File  Edit  Search  View  Chat</div>
                <div className="border-b border-[#cbc4ba] bg-[#d3cec5] px-2 pt-2 text-[11px] text-[#554c43]">
                  <div className="flex gap-1">
                    <div className="rounded-t border border-[#b8b1a7] border-b-0 bg-[#fffdf9] px-3 py-1">general.log</div>
                    <div className="rounded-t border border-[#b8b1a7] border-b-0 bg-[#e3ddd4] px-3 py-1">presence.txt</div>
                    <div className="rounded-t border border-[#b8b1a7] border-b-0 bg-[#e3ddd4] px-3 py-1">memo.md</div>
                  </div>
                </div>
                <div className="flex min-h-0 flex-1 overflow-hidden bg-[#fffdf9] font-mono text-[13px] text-[#2b241d]">
                  <div className="w-12 border-r border-[#dad4cb] bg-[#f1ece5]">
                    {messages.map((message, index) => (
                      <div key={message.id} className="h-7 border-b border-[#eee7dd] px-2 text-right leading-7 text-[#988b7b]">
                        {index + 1}
                      </div>
                    ))}
                  </div>
                  <div className="scrollbar-subtle flex-1 overflow-y-auto">
                    {messages.length === 0 ? (
                      <div className="p-6 text-sm text-[#8c8172]">// no log lines yet</div>
                    ) : (
                      messages.map((message) => (
                        <div key={message.id} className="min-h-7 border-b border-[#f2ede6] px-3 py-1 leading-5 hover:bg-[#f6f1ea]">
                          <span className="text-[#8f8373]">[{formatTime(message.created_at)}]</span>{" "}
                          <span className={clsx(message.sender_name === effectiveNickname ? "font-bold text-[#2f6e44]" : "font-bold text-[#325a9e]")}>
                            {message.sender_name}
                          </span>{" "}
                          <span className="text-[#5f554a]">&gt;</span>{" "}
                          <span>{message.content}</span>
                        </div>
                      ))
                    )}
                    <div ref={messageEndRef} />
                  </div>
                </div>
                <div className="border-t-2 border-[#b8b1a7] bg-[#f4efe7] p-2">
                  <div className="flex items-center gap-2">
                    <div className="w-12 text-right font-mono text-[12px] text-[#7d7265]">{messages.length + 1}</div>
                    <div className="font-mono text-[12px] font-bold text-[#2f6e44]">{effectiveNickname}&gt;</div>
                    <input
                      value={draftMessage}
                      onChange={(event) => setDraftMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                      placeholder="Write a new line..."
                      className="min-w-0 flex-1 bg-transparent font-mono text-[13px] outline-none placeholder:text-[#9b8f80]"
                    />
                    <button type="button" onClick={() => void handleSendMessage()} disabled={!hasSupabase || !draftMessage.trim()} className="rounded border border-[#9b9388] bg-[#e5ddd1] px-3 py-1 text-[11px] disabled:opacity-40">
                      Write
                    </button>
                  </div>
                </div>
                <div className="border-t border-[#c8c1b7] bg-[#e7e1d7] px-3 py-1 text-[11px] text-[#5d5247]">
                  Ln {messages.length + 1} | UTF-8 | {status}
                </div>
              </>
            ) : (
              <>
                <div className="scrollbar-subtle flex-1 overflow-y-auto p-4 md:p-6">
                  <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                    {messages.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] px-6 py-10 text-center text-sm text-[var(--muted)]">
                        No messages yet. Start the conversation.
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isOwnMessage = message.sender_name === effectiveNickname;
                        return (
                          <article key={message.id} className={clsx("flex", isOwnMessage ? "justify-end" : "justify-start")}>
                            <div className="max-w-[85%]">
                              <div className="mb-1 px-1 text-[10px] text-[var(--muted)]">
                                {message.sender_name} · {formatTime(message.created_at)}
                              </div>
                              <div className={clsx("rounded-2xl px-4 py-3 text-sm shadow-sm", isOwnMessage ? "rounded-tr-none bg-[var(--foreground)] text-[var(--background)]" : "rounded-tl-none border border-[var(--border)] bg-white/5")}>
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
                <footer className="border-t border-[var(--border)] px-4 py-4 md:px-6">
                  <div className="mx-auto max-w-5xl">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm text-[var(--muted)]">{hasSupabase ? "Permanent storage enabled" : "Waiting for Supabase config"}</div>
                      <div className="text-xs text-[var(--muted)]">{status}</div>
                    </div>
                    <div className="relative">
                      <textarea
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                        placeholder="Type your message..."
                        rows={2}
                        disabled={!hasSupabase}
                        className="min-h-[52px] max-h-32 w-full resize-none rounded-2xl border border-[var(--border)] bg-white/5 py-3.5 pl-4 pr-20 text-sm outline-none disabled:opacity-60"
                      />
                      <button type="button" onClick={() => void handleSendMessage()} disabled={!hasSupabase || !draftMessage.trim()} className="absolute right-2 top-1/2 h-9 w-14 -translate-y-1/2 rounded-xl bg-[var(--accent)] text-xs font-bold text-white disabled:opacity-40">
                        Send
                      </button>
                    </div>
                  </div>
                </footer>
              </>
            )}
          </section>
        </div>
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black">Profile and layout</h3>
              <button type="button" onClick={() => setSettingsOpen(false)} className="text-[var(--muted)]">x</button>
            </div>
            <div className="mt-6 space-y-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Nickname</label>
                <div className="mt-3 flex gap-2">
                  <input value={nicknameInput} onChange={(event) => setNicknameInput(event.target.value)} placeholder={effectiveNickname} className="h-12 min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-white/5 px-4 outline-none" />
                  <button type="button" onClick={() => { handleSaveNickname(); setSettingsOpen(false); }} className="rounded-2xl bg-[var(--accent)] px-6 font-bold text-white">
                    Save
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Layout</label>
                <div className="mt-3 grid gap-3">
                  {LAYOUT_ITEMS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setLayout(item.id)}
                      className={clsx(
                        "rounded-2xl border px-4 py-4 text-left transition-all",
                        layout === item.id ? "border-transparent bg-[var(--accent)] text-white" : "border-[var(--border)] bg-white/5 hover:bg-white/10"
                      )}
                    >
                      <div className="font-semibold">{item.label}</div>
                      <div className={clsx("mt-1 text-xs", layout === item.id ? "text-white/80" : "text-[var(--muted)]")}>{item.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {joinDialogOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Room controls</p>
                <h3 className="mt-2 text-2xl font-bold">Create / Join room</h3>
              </div>
              <button type="button" onClick={() => setJoinDialogOpen(false)} className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs">
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[28px] border border-[var(--border)] bg-[#171717] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.28)]">
                <h4 className="text-[19px] font-bold text-white">오픈굴 만들기</h4>
                <input
                  value={draftRoomTitle}
                  onChange={(event) => setDraftRoomTitle(event.target.value)}
                  placeholder="채팅방 이름을 입력하세요"
                  className="mt-8 h-16 w-full rounded-2xl border border-[#34373d] bg-[#1d1f23] px-5 text-xl text-[#f1e4d0] outline-none placeholder:text-[#ad9a82]"
                />

                <div className="mt-8 rounded-3xl border border-[#34373d] bg-[#202224] p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🔒</span>
                      <div>
                        <div className="text-[15px] font-bold text-[#f1e4d0]">입장 비밀번호 잠금</div>
                        <div className="mt-1 text-xs text-[#8e7c67]">
                          켜면 비밀방으로 생성됩니다.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNewRoomPasswordEnabled((current) => !current)}
                      className={clsx(
                        "relative h-10 w-20 rounded-full transition-all",
                        newRoomPasswordEnabled ? "bg-[#08c952]" : "bg-[#3a3d42]"
                      )}
                      aria-label="Toggle room password"
                    >
                      <span
                        className={clsx(
                          "absolute top-1 h-8 w-8 rounded-full bg-white transition-all",
                          newRoomPasswordEnabled ? "left-[44px]" : "left-1"
                        )}
                      />
                    </button>
                  </div>

                  {newRoomPasswordEnabled ? (
                    <input
                      value={newRoomPassword}
                      onChange={(event) => setNewRoomPassword(event.target.value.slice(0, 20))}
                      placeholder="비밀번호 입력 (최대 20자)"
                      className="mt-5 h-14 w-full rounded-2xl border border-[#34373d] bg-[#17191d] px-5 text-lg text-[#f1e4d0] outline-none placeholder:text-[#ad9a82]"
                    />
                  ) : null}
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-[#8e7c67]">
                  <span>{newRoomVisibility === "secret" ? "비밀방" : "오픈방"}으로 생성됩니다.</span>
                  <span>{hasSupabase ? "실시간 생성 가능" : "Supabase 필요"}</span>
                </div>

                <button
                  type="button"
                  onClick={() => void handleCreateRoom()}
                  disabled={!hasSupabase || !draftRoomTitle.trim() || (newRoomPasswordEnabled && !newRoomPassword.trim())}
                  className="mt-5 w-full rounded-2xl bg-[var(--accent)] px-4 py-4 text-sm font-semibold text-white disabled:opacity-40"
                >
                  방 만들기
                </button>
              </div>

              <div className="rounded-2xl border border-[var(--border)] bg-white/[0.03] p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">Join room</p>
                <div className="mt-4 flex gap-2">
                  <input value={joinRoomCode} onChange={(event) => setJoinRoomCode(event.target.value)} placeholder="Room ID" className="h-12 min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-white/5 px-4 text-sm outline-none" />
                  <button type="button" onClick={handleJoinRoomByCode} className="rounded-2xl border border-[var(--border)] px-4 text-sm">
                    Join
                  </button>
                </div>
                <input
                  value={joinRoomPassword}
                  onChange={(event) => setJoinRoomPassword(event.target.value)}
                  placeholder="Password if needed"
                  className="mt-3 h-12 w-full rounded-2xl border border-[var(--border)] bg-white/5 px-4 text-sm outline-none"
                />
                <div className="scrollbar-subtle mt-4 max-h-56 overflow-y-auto pr-1">
                  <div className="flex flex-col gap-2">
                    {joinableRooms.length === 0 ? (
                      <div className="rounded-2xl border border-[var(--border)] px-4 py-4 text-sm text-[var(--muted)]">No unjoined rooms right now.</div>
                    ) : (
                      joinableRooms.map((room) => (
                        <button key={room.id} type="button" onClick={() => handleJoinRoom(room.id)} className="rounded-2xl border border-[var(--border)] px-4 py-4 text-left hover:bg-white/5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold">{room.title}</span>
                            <span className="text-[10px] text-[var(--muted)]">{room.visibility === "secret" ? "Secret" : "Open"}</span>
                          </div>
                          <div className="mt-2 text-[10px] text-[var(--muted)]">{room.id}</div>
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
