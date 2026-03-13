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

const THEME_LABELS: Record<ThemeMode, string> = {
  dark: "Dark",
  light: "Light",
  excel: "Excel"
};

const NAV_ITEMS: { id: NavTab; icon: string; label: string }[] = [
  { id: "open", icon: "O", label: "Open Rooms" },
  { id: "private", icon: "P", label: "Private Rooms" },
  { id: "feedback", icon: "F", label: "Feedback" }
];

const EXCEL_COLUMNS = ["A", "B", "C", "D"];

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

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  const hasSupabase = Boolean(supabase);
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
    if (!supabase) {
      return;
    }

    const client = supabase as any;
    let isMounted = true;
    const roomsChannel = client.channel("public:rooms");

    async function loadRooms() {
      setStatus("Loading rooms...");

      const { data, error } = await client
        .from("rooms")
        .select("*")
        .order("created_at", { ascending: true });

      if (!isMounted) {
        return;
      }

      if (error) {
        setStatus(`Failed to load rooms: ${error.message}`);
        return;
      }

      const nextRooms = (data ?? []) as Room[];
      setRooms(nextRooms);
      setActiveRoomId((current) => current || nextRooms[0]?.id || "");
      setStatus("Realtime connected.");
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
      config: {
        presence: {
          key: presenceKey
        }
      }
    });

    function buildNickname(state: PresenceState) {
      if (savedNickname.trim()) {
        return savedNickname.trim();
      }

      const occupiedNumbers = Object.values(state)
        .flat()
        .map((entry) => entry.number)
        .filter((value): value is number => value !== null);

      const availableNumber = getAvailableTyranoNumber(occupiedNumbers);
      return formatTyranoName(availableNumber);
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
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `room_id=eq.${activeRoomId}`
        },
        (payload: { new: Message }) => {
          const incoming = payload.new as Message;
          setMessages((current) => {
            if (current.some((message) => message.id === incoming.id)) {
              return current;
            }

            return [...current, incoming];
          });
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

        await roomChannel.track({
          nickname: candidate,
          number: extractTyranoNumber(candidate)
        });
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
      .insert({ title: draftRoomTitle.trim() })
      .select()
      .single();

    if (error) {
      setStatus(`Failed to create room: ${error.message}`);
      return;
    }

    setDraftRoomTitle("");
    setRooms((current) => {
      if (current.some((room) => room.id === data.id)) {
        return current;
      }

      return [...current, data];
    });
    setActiveRoomId(data.id);
    setSidebarOpen(false);
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

    setDraftMessage("");
  }

  function handleSaveNickname() {
    const nextNickname = nicknameInput.trim();
    setSavedNickname(nextNickname);
    saveNickname(nextNickname);
  }

  return (
    <main className="safe-screen bg-[var(--background)] text-foreground">
      <div className="flex h-screen min-h-screen flex-col md:h-[100dvh]">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen((current) => !current)}
            className="ui-transition rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-white/5"
          >
            Menu
          </button>
          <div className="text-sm font-semibold">{activeRoom?.title ?? "Tyrano World"}</div>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="ui-transition rounded-xl border border-border bg-card px-4 py-2 text-sm hover:bg-white/5"
          >
            {THEME_LABELS[theme]}
          </button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[68px_288px_minmax(0,1fr)]">
          <nav className="hidden border-r border-border bg-[var(--sidebar)] lg:flex lg:flex-col lg:items-center lg:justify-between lg:py-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-sm font-bold">
                TY
              </div>
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={clsx(
                    "ui-transition flex h-12 w-12 items-center justify-center rounded-xl text-xs",
                    activeTab === item.id
                      ? "bg-white/10 text-[var(--accent)]"
                      : "text-muted hover:bg-white/5"
                  )}
                  aria-label={item.label}
                  title={item.label}
                >
                  {item.icon}
                </button>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3">
              <button
                type="button"
                className="ui-transition flex h-12 w-12 items-center justify-center rounded-xl text-xs text-muted hover:bg-white/5"
                aria-label="Settings"
              >
                ST
              </button>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--accent)] text-xs font-bold text-white">
                {effectiveNickname.slice(-2)}
              </div>
            </div>
          </nav>

          <aside
            className={clsx(
              "min-h-0 border-r border-border bg-surface",
              sidebarOpen ? "block" : "hidden",
              "lg:block"
            )}
          >
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-border px-5 py-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                      {activeTab === "open"
                        ? "Open Rooms"
                        : activeTab === "private"
                          ? "Private Rooms"
                          : "Feedback"}
                    </p>
                    <h1 className="mt-2 text-lg font-bold">
                      {activeTab === "open"
                        ? "Public Threads"
                        : activeTab === "private"
                          ? "Private Lounge"
                          : "Feedback Box"}
                    </h1>
                  </div>
                  <span className="text-[10px] text-white/30">{filteredRooms.length} rooms</span>
                </div>

                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search rooms"
                  className="ui-transition mt-4 h-10 w-full rounded-xl border border-transparent bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50"
                />
              </div>

              <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-3 py-3">
                <div className="flex flex-col gap-2">
                  {filteredRooms.length === 0 ? (
                    <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-5 text-sm text-white/40">
                      No rooms found.
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
                          "ui-transition rounded-2xl px-4 py-4 text-left",
                          room.id === activeRoomId
                            ? "bg-white/10 ring-1 ring-white/10"
                            : "hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-[14px] font-semibold">{room.title}</p>
                          <span className="text-[10px] text-white/30">
                            {new Date(room.created_at).toLocaleDateString("ko-KR")}
                          </span>
                        </div>
                        <p className="mt-2 text-[12px] text-white/50">
                          Permanent room history and live updates.
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="border-t border-border px-4 py-4">
                <div className="rounded-2xl border border-white/5 bg-card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{effectiveNickname}</p>
                      <p className="mt-1 text-xs text-white/40">Online now {presenceCount}</p>
                    </div>
                    <button
                      type="button"
                      className="ui-transition rounded-xl border border-border px-3 py-2 text-xs hover:bg-white/5"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section className="flex min-h-0 flex-col bg-[var(--background)]">
            <header className="border-b border-border px-4 py-4 md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-white/50">
                    {activeRoom ? "Current Room" : "No Room Selected"}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight">
                    {activeRoom?.title ?? "Choose a room to start"}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={clsx(
                      "ui-transition rounded-xl border px-3 py-2 text-xs",
                      theme === "dark"
                        ? "border-transparent bg-[var(--accent)] text-white"
                        : "border-border hover:bg-white/5"
                    )}
                  >
                    Dark
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={clsx(
                      "ui-transition rounded-xl border px-3 py-2 text-xs",
                      theme === "light"
                        ? "border-transparent bg-[var(--accent)] text-white"
                        : "border-border hover:bg-white/5"
                    )}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("excel")}
                    className={clsx(
                      "ui-transition rounded-xl border px-3 py-2 text-xs",
                      theme === "excel"
                        ? "border-transparent bg-[var(--accent)] text-white"
                        : "border-border hover:bg-white/5"
                    )}
                  >
                    Excel
                  </button>
                </div>
              </div>
            </header>

            <div
              className={clsx(
                "scrollbar-subtle flex-1 overflow-y-auto px-4 py-5 md:px-6",
                theme === "excel" && "bg-grid bg-[size:56px_56px]"
              )}
            >
              <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
                {messages.length === 0 ? (
                  <div className="rounded-2xl border border-white/5 bg-card px-6 py-10 text-center text-sm text-white/40">
                    No messages yet. Leave the first message in this room.
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const isOwnMessage = message.sender_name === effectiveNickname;

                    if (theme === "excel") {
                      return (
                        <article key={message.id} className="bg-white shadow-sm">
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
                            <div className="border-r border-[#c9d7c8] px-3 py-3 text-[#55705d]">
                              {index + 1}
                            </div>
                            <div className="border-r border-[#c9d7c8] px-3 py-3 font-medium text-[#17311d]">
                              {message.sender_name}
                            </div>
                            <div className="border-r border-[#c9d7c8] px-3 py-3 text-[#17311d]">
                              {message.content}
                            </div>
                            <div className="px-3 py-3 text-right text-[#55705d]">
                              {formatTime(message.created_at)}
                            </div>
                          </div>
                        </article>
                      );
                    }

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
                              "shadow-sm rounded-2xl px-4 py-2.5 text-[14px]",
                              isOwnMessage
                                ? "rounded-tr-none bg-white text-black"
                                : "rounded-tl-none border border-white/5 bg-[#2c2c2c] text-white"
                            )}
                          >
                            {message.content}
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
                <div ref={messageEndRef} />
              </div>
            </div>

            <footer className="border-t border-border px-4 py-4 md:px-6">
              <div className="mx-auto max-w-5xl">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-white/30">
                    {hasSupabase ? "Permanent storage enabled." : "Waiting for Supabase config."}
                  </div>
                  <div className="text-xs text-white/30">{status}</div>
                </div>

                <div className="relative group">
                  <textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder={
                      activeRoom ? "Type your message..." : "Select or create a room first"
                    }
                    rows={3}
                    disabled={!activeRoom}
                    className="ui-transition min-h-[52px] max-h-32 w-full resize-none rounded-2xl border border-white/10 bg-card py-3.5 pl-4 pr-20 text-[14px] text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!activeRoom || !hasSupabase}
                    className="ui-transition absolute right-2 top-1/2 h-9 w-14 -translate-y-1/2 rounded-xl bg-[var(--accent)] text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-2xl border border-white/5 bg-card p-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Nickname
                    </label>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={nicknameInput}
                        onChange={(event) => setNicknameInput(event.target.value)}
                        placeholder={effectiveNickname}
                        className="ui-transition h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50"
                      />
                      <button
                        type="button"
                        onClick={handleSaveNickname}
                        className="ui-transition rounded-2xl border border-white/10 px-4 text-sm hover:bg-white/5"
                      >
                        Save
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/5 bg-card p-4">
                    <label className="text-xs font-bold uppercase tracking-wider text-white/50">
                      Quick room
                    </label>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={draftRoomTitle}
                        onChange={(event) => setDraftRoomTitle(event.target.value)}
                        placeholder="New room"
                        className="ui-transition h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-[color:var(--accent)]/50"
                      />
                      <button
                        type="button"
                        onClick={handleCreateRoom}
                        disabled={!hasSupabase}
                        className="ui-transition rounded-2xl bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </footer>
          </section>
        </div>
      </div>
    </main>
  );
}
