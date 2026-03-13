"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { extractTyranoNumber, formatTyranoName, getAvailableTyranoNumber } from "@/lib/chat/nickname";
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

<<<<<<< HEAD
const THEME_LABELS: Record<ThemeMode, string> = { dark: "Dark", light: "Light", excel: "Excel" };
=======
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
const NAV_ITEMS: { id: NavTab; icon: string; label: string }[] = [
  { id: "open", icon: "🌐", label: "오픈굴" },
  { id: "private", icon: "🔒", label: "토끼굴" },
  { id: "feedback", icon: "💌", label: "건의함" }
];
<<<<<<< HEAD
const ROOM_FILTERS: { id: RoomListTab; label: string }[] = [
  { id: "open", label: "오픈채팅방" },
  { id: "secret", label: "비밀 채팅방" },
  { id: "joined", label: "참여중인 채팅방" }
];
const EXCEL_COLUMNS = ["A", "B", "C", "D"];
=======
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146

function formatTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function ChatShell() {
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
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
  const [status, setStatus] = useState("Add Supabase env values to enable realtime chat.");
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
  const filteredRooms = rooms.filter((room) => {
    if (!room.title.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
    if (roomListTab === "open") return room.visibility === "open";
    if (roomListTab === "secret") return room.visibility === "secret";
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

<<<<<<< HEAD
  function markRoomAsJoined(roomId: string) {
    setJoinedRoomIds((current) => {
      if (current.includes(roomId)) return current;
      const next = [...current, roomId];
      saveJoinedRooms(next);
      return next;
    });
  }

=======
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
  useEffect(() => {
    if (!supabase) return;
    const client = supabase as any;
    let isMounted = true;
    const roomsChannel = client.channel("public:rooms");

    async function loadRooms() {
<<<<<<< HEAD
      setStatus("Loading rooms...");
=======
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
      const { data, error } = await client.from("rooms").select("*").order("created_at", { ascending: true });
      if (!isMounted) return;
      if (error) {
        setStatus(`Failed to load rooms: ${error.message}`);
        return;
      }
<<<<<<< HEAD
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
    roomsChannel.on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => void loadRooms()).subscribe();
=======
      const nextRooms = (data ?? []) as Room[];
      setRooms(nextRooms);
      setActiveRoomId((current) => current || nextRooms[0]?.id || "");
    }

    void loadRooms();
    roomsChannel.on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, () => {
      void loadRooms();
    }).subscribe();

>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
    return () => {
      isMounted = false;
      void client.removeChannel(roomsChannel);
    };
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !activeRoomId) return;
    const client = supabase as any;
    let isActive = true;
<<<<<<< HEAD
    const roomChannel = client.channel(`room:${activeRoomId}`, {
      config: { presence: { key: `${Math.random().toString(36).slice(2, 9)}-${Date.now()}` } }
    });
=======
    const presenceKey = `${Math.random().toString(36).slice(2, 9)}-${Date.now()}`;
    const roomChannel = client.channel(`room:${activeRoomId}`, { config: { presence: { key: presenceKey } } });
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146

    function buildNickname(state: PresenceState) {
      if (savedNickname.trim()) return savedNickname.trim();
      const occupiedNumbers = Object.values(state).flat().map((entry) => entry.number).filter((value): value is number => value !== null);
<<<<<<< HEAD
      return formatTyranoName(getAvailableTyranoNumber(occupiedNumbers));
=======
      const availableNumber = getAvailableTyranoNumber(occupiedNumbers);
      return formatTyranoName(availableNumber);
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
    }

    async function loadMessages() {
      const { data, error } = await client.from("messages").select("*").eq("room_id", activeRoomId).order("created_at", { ascending: true });
      if (!isActive) return;
<<<<<<< HEAD
      if (error) {
        setStatus(`Failed to load messages: ${error.message}`);
        return;
      }
=======
      if (error) return;
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
      setMessages((data ?? []) as Message[]);
    }

    void loadMessages();
<<<<<<< HEAD
    roomChannel
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${activeRoomId}` }, (payload: { new: Message }) => {
        setMessages((current) => current.some((message) => message.id === payload.new.id) ? current : [...current, payload.new]);
      })
      .on("presence", { event: "sync" }, () => {
        const state = roomChannel.presenceState() as PresenceState;
        setPresenceCount(Math.max(Object.values(state).flat().length, 1));
        if (!savedNickname.trim()) setSessionNickname(buildNickname(state));
      })
      .subscribe(async (subscriptionStatus: string) => {
        if (subscriptionStatus !== "SUBSCRIBED") return;
        const state = roomChannel.presenceState() as PresenceState;
        const candidate = buildNickname(state);
        if (!savedNickname.trim()) setSessionNickname(candidate);
        await roomChannel.track({ nickname: candidate, number: extractTyranoNumber(candidate) });
      });
=======
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
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146

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
<<<<<<< HEAD
    const { data, error } = await client.from("rooms").insert({ title: draftRoomTitle.trim(), visibility: newRoomVisibility }).select().single();
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
    setRooms((current) => current.some((room) => room.id === createdRoom.id) ? current : [...current, createdRoom]);
    setActiveRoomId(createdRoom.id);
    markRoomAsJoined(createdRoom.id);
    setJoinDialogOpen(false);
    setSidebarOpen(false);
  }

  function handleJoinRoom(roomId: string) {
    setActiveRoomId(roomId);
    markRoomAsJoined(roomId);
    setJoinDialogOpen(false);
    setSidebarOpen(false);
    setRoomListTab("joined");
  }

  function handleJoinRoomByCode() {
    const room = rooms.find((item) => item.id === joinRoomCode.trim());
    if (!room) {
      setStatus("Room code not found.");
      return;
    }
    handleJoinRoom(room.id);
    setJoinRoomCode("");
  }

=======
    const { data, error } = await client.from("rooms").insert({ title: draftRoomTitle.trim() }).select().single();
    if (error) return;
    setDraftRoomTitle("");
    setRooms((current) => current.some((r) => r.id === data.id) ? current : [...current, data]);
    setActiveRoomId(data.id);
  }

>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
  async function handleSendMessage() {
    if (!supabase || !activeRoomId || !draftMessage.trim()) return;
    const client = supabase as any;
    const { error } = await client.from("messages").insert({
      room_id: activeRoomId,
      sender_name: savedNickname.trim() || sessionNickname || formatTyranoName(1),
      content: draftMessage.trim()
    });
<<<<<<< HEAD
    if (error) {
      setStatus(`Failed to send message: ${error.message}`);
      return;
    }
    markRoomAsJoined(activeRoomId);
=======
    if (error) return;
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
    setDraftMessage("");
  }

  function handleSaveNickname() {
    const nextNickname = nicknameInput.trim();
    setSavedNickname(nextNickname);
    saveNickname(nextNickname);
  }

  return (
    <main className="safe-screen bg-[#121212] text-white">
      <div className="flex h-screen min-h-screen flex-col md:h-[100dvh]">
<<<<<<< HEAD
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <button type="button" onClick={() => setSidebarOpen((current) => !current)} className="ui-transition rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-white/5">Menu</button>
          <div className="text-sm font-semibold">{activeRoom?.title ?? "Tyrano World"}</div>
          <button type="button" onClick={() => setSettingsOpen(true)} className="ui-transition rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-white/5">Settings</button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[68px_288px_minmax(0,1fr)]">
          <nav className="hidden border-r border-border bg-[var(--sidebar)] lg:flex lg:flex-col lg:items-center lg:justify-between lg:py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-sm font-bold">TY</div>
              {NAV_ITEMS.map((item) => (
                <button key={item.id} type="button" onClick={() => setActiveTab(item.id)} className={clsx("ui-transition flex h-12 w-12 items-center justify-center rounded-xl text-xs", activeTab === item.id ? "bg-white/10 text-[var(--accent)]" : "text-muted hover:bg-white/5")} aria-label={item.label} title={item.label}>{item.icon}</button>
              ))}
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">{effectiveNickname.slice(-2)}</div>
          </nav>

          <aside className={clsx("min-h-0 border-r border-border bg-surface", sidebarOpen ? "block" : "hidden", "lg:block")}>
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-border px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/50">{activeTab === "open" ? "Open Rooms" : activeTab === "private" ? "Private Rooms" : "Feedback"}</p>
                    <h1 className="mt-2 text-lg font-bold">{activeTab === "open" ? "Public Threads" : activeTab === "private" ? "Private Lounge" : "Feedback Box"}</h1>
                  </div>
                  <button type="button" onClick={() => setSettingsOpen(true)} className="ui-transition rounded-xl border border-border px-3 py-2 text-xs hover:bg-white/5">설정</button>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {ROOM_FILTERS.map((filter) => (
                    <div key={filter.id} className="flex items-center gap-1">
                      <button type="button" onClick={() => setRoomListTab(filter.id)} className={clsx("ui-transition rounded-xl px-3 py-2 text-xs", roomListTab === filter.id ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/5")}>{filter.label}</button>
                      {filter.id === "joined" ? <button type="button" onClick={() => setJoinDialogOpen(true)} className="ui-transition flex h-8 w-8 items-center justify-center rounded-xl border border-border text-sm hover:bg-white/5" aria-label="Create or join room">+</button> : null}
                    </div>
                  ))}
                </div>

                <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search rooms" className="ui-transition mt-4 h-10 w-full rounded-xl border border-transparent bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50" />
=======
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
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
              </div>
            </div>

<<<<<<< HEAD
              <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <div className="flex flex-col gap-2">
                  {filteredRooms.length === 0 ? <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-5 text-sm text-white/40">No rooms found in this section.</div> : filteredRooms.map((room) => (
                    <button key={room.id} type="button" onClick={() => { setActiveRoomId(room.id); markRoomAsJoined(room.id); setSidebarOpen(false); }} className={clsx("ui-transition rounded-2xl px-4 py-4 text-left", room.id === activeRoomId ? "bg-white/10 ring-1 ring-white/10" : "hover:bg-white/5")}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[14px] font-semibold">{room.title}</p>
                        <span className="text-[10px] text-white/30">{new Date(room.created_at).toLocaleDateString("ko-KR")}</span>
                      </div>
                      <p className="mt-2 text-[12px] text-white/50">{room.visibility === "secret" ? "Secret room for invited participants." : "Open room with permanent history."}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border px-4 py-4">
                <div className="rounded-2xl border border-white/5 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{effectiveNickname}</p>
                      <p className="mt-1 text-xs text-white/40">Online now {presenceCount}</p>
                    </div>
                    <button type="button" className="ui-transition rounded-xl border border-border px-3 py-2 text-xs hover:bg-white/5">Logout</button>
=======
            <div className="scrollbar-subtle flex-1 overflow-y-auto px-2 pb-4">
              <div className="space-y-1">
                {filteredRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center opacity-30">
                    <p className="text-sm text-white">방이 없습니다</p>
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
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

<<<<<<< HEAD
          <section className="flex min-h-0 flex-col bg-[var(--background)]">
            <header className="border-b border-border px-4 py-4 md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/50">{activeRoom ? "Current Room" : "No Room Selected"}</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">{activeRoom?.title ?? "Choose a room to start"}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-xl border border-border px-3 py-2 text-xs text-white/50">Theme {THEME_LABELS[theme]}</span>
                  <button type="button" onClick={() => setSettingsOpen(true)} className="ui-transition rounded-xl border border-border px-3 py-2 text-xs hover:bg-white/5">Open settings</button>
                </div>
              </div>
            </header>

            <div className={clsx("scrollbar-subtle flex-1 overflow-y-auto px-4 py-5 md:px-6", theme === "excel" && "bg-grid bg-[size:56px_56px]")}>
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                {messages.length === 0 ? <div className="rounded-2xl border border-white/5 bg-card px-6 py-10 text-center text-sm text-white/40">No messages yet. Leave the first message in this room.</div> : messages.map((message, index) => {
                  const isOwnMessage = message.sender_name === effectiveNickname;
                  if (theme === "excel") {
                    return (
                      <article key={message.id} className="bg-white shadow-sm">
                        <div className="grid grid-cols-[72px_1.2fr_2fr_96px] border border-[#c9d7c8] text-sm">
                          {EXCEL_COLUMNS.map((column, cellIndex) => <div key={`${message.id}-${column}`} className={clsx("border-b border-r border-[#c9d7c8] bg-[#f3f8f1] px-3 py-2 font-medium text-[#3e5f45]", cellIndex === EXCEL_COLUMNS.length - 1 && "border-r-0")}>{column}</div>)}
                          <div className="border-r border-[#c9d7c8] px-3 py-3 text-[#55705d]">{index + 1}</div>
                          <div className="border-r border-[#c9d7c8] px-3 py-3 font-medium text-[#17311d]">{message.sender_name}</div>
                          <div className="border-r border-[#c9d7c8] px-3 py-3 text-[#17311d]">{message.content}</div>
                          <div className="px-3 py-3 text-right text-[#55705d]">{formatTime(message.created_at)}</div>
=======
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
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
                        </div>
                      </div>
                    );
<<<<<<< HEAD
                  }
                  return (
                    <article key={message.id} className={clsx("flex", isOwnMessage ? "justify-end" : "justify-start")}>
                      <div className="max-w-[85%]">
                        <div className="mb-1 px-1 text-[10px] text-white/30">{message.sender_name} · {formatTime(message.created_at)}</div>
                        <div className={clsx("shadow-sm rounded-2xl px-4 py-2.5 text-[14px]", isOwnMessage ? "rounded-tr-none bg-white text-black" : "rounded-tl-none border border-white/5 bg-[#2c2c2c] text-white")}>{message.content}</div>
                      </div>
                    </article>
                  );
                })}
                <div ref={messageEndRef} />
              </div>
            </div>

            <footer className="border-t border-border px-4 py-4 md:px-6">
              <div className="mx-auto max-w-5xl">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-white/30">{hasSupabase ? "Permanent storage enabled." : "Waiting for Supabase config."}</div>
                  <div className="text-xs text-white/30">{status}</div>
                </div>
                <div className="relative group">
                  <textarea value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} placeholder={activeRoom ? "Type your message..." : "Select or create a room first"} rows={3} disabled={!activeRoom} className="ui-transition min-h-[52px] max-h-32 w-full resize-none rounded-2xl border border-white/10 bg-card py-3.5 pl-4 pr-20 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-60" />
                  <button type="button" onClick={handleSendMessage} disabled={!activeRoom || !hasSupabase} className="ui-transition absolute right-2 top-1/2 h-9 w-14 -translate-y-1/2 rounded-xl bg-[var(--accent)] text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Send</button>
                </div>
=======
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
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
              </div>
            )}
          </section>
        </div>
      </div>

<<<<<<< HEAD
      {settingsOpen ? <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/60 p-4"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-white/50">Settings</p><h3 className="mt-2 text-2xl font-bold">Profile and layout</h3></div><button type="button" onClick={() => setSettingsOpen(false)} className="ui-transition rounded-xl border border-border px-3 py-2 text-xs hover:bg-white/5">Close</button></div><div className="mt-6 space-y-5"><div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"><label className="text-xs font-bold uppercase tracking-wider text-white/50">Nickname</label><div className="mt-3 flex gap-2"><input value={nicknameInput} onChange={(event) => setNicknameInput(event.target.value)} placeholder={effectiveNickname} className="ui-transition h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50" /><button type="button" onClick={handleSaveNickname} className="ui-transition rounded-2xl border border-white/10 px-4 text-sm hover:bg-white/5">Save</button></div></div><div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"><label className="text-xs font-bold uppercase tracking-wider text-white/50">Layout theme</label><div className="mt-3 grid grid-cols-3 gap-2">{(Object.keys(THEME_LABELS) as ThemeMode[]).map((mode) => <button key={mode} type="button" onClick={() => setTheme(mode)} className={clsx("ui-transition rounded-xl border px-3 py-3 text-sm", theme === mode ? "border-transparent bg-[var(--accent)] text-white" : "border-border hover:bg-white/5")}>{THEME_LABELS[mode]}</button>)}</div></div></div></div></div> : null}

      {joinDialogOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-card p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-white/50">Joined rooms</p><h3 className="mt-2 text-2xl font-bold">방 만들기 / 방 참여하기</h3></div><button type="button" onClick={() => setJoinDialogOpen(false)} className="ui-transition rounded-xl border border-border px-3 py-2 text-xs hover:bg-white/5">Close</button></div><div className="mt-6 grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"><p className="text-xs font-bold uppercase tracking-wider text-white/50">Create room</p><input value={draftRoomTitle} onChange={(event) => setDraftRoomTitle(event.target.value)} placeholder="Room title" className="ui-transition mt-4 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50" /><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => setNewRoomVisibility("open")} className={clsx("ui-transition rounded-xl border px-3 py-3 text-sm", newRoomVisibility === "open" ? "border-transparent bg-[var(--accent)] text-white" : "border-border hover:bg-white/5")}>Open room</button><button type="button" onClick={() => setNewRoomVisibility("secret")} className={clsx("ui-transition rounded-xl border px-3 py-3 text-sm", newRoomVisibility === "secret" ? "border-transparent bg-[var(--accent)] text-white" : "border-border hover:bg-white/5")}>Secret room</button></div><button type="button" onClick={handleCreateRoom} disabled={!hasSupabase} className="ui-transition mt-3 w-full rounded-2xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">Create now</button></div><div className="rounded-2xl border border-white/5 bg-white/[0.03] p-4"><p className="text-xs font-bold uppercase tracking-wider text-white/50">Join room</p><div className="mt-4 flex gap-2"><input value={joinRoomCode} onChange={(event) => setJoinRoomCode(event.target.value)} placeholder="Room ID" className="ui-transition h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50" /><button type="button" onClick={handleJoinRoomByCode} className="ui-transition rounded-2xl border border-white/10 px-4 text-sm hover:bg-white/5">Join</button></div><div className="scrollbar-subtle mt-4 max-h-56 overflow-y-auto pr-1"><div className="flex flex-col gap-2">{joinableRooms.length === 0 ? <div className="rounded-2xl border border-white/5 px-4 py-4 text-sm text-white/40">There are no unjoined rooms right now.</div> : joinableRooms.map((room) => <button key={room.id} type="button" onClick={() => handleJoinRoom(room.id)} className="ui-transition rounded-2xl border border-white/5 px-4 py-4 text-left hover:bg-white/5"><div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{room.title}</span><span className="text-[10px] text-white/30">{room.visibility === "secret" ? "Secret" : "Open"}</span></div><div className="mt-2 text-[10px] text-white/30">{room.id}</div></button>)}</div></div></div></div></div></div> : null}
=======
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
>>>>>>> 7459fa976c42934a925a8bbc2a4c0cd990881146
    </main>
  );
}
