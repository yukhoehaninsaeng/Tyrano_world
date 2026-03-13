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

const THEME_LABELS: Record<ThemeMode, string> = {
  light: "White",
  dark: "Dark",
  excel: "Excel"
};

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

  const [theme, setTheme] = useState<ThemeMode>("light");
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

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  const hasSupabase = Boolean(supabase);
  const effectiveNickname = savedNickname.trim() || sessionNickname || "Generating...";

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
    <main className="safe-screen px-4 py-4 text-foreground md:px-7 md:py-7">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1440px] flex-col gap-4 lg:h-[calc(100dvh-3.5rem)]">
        <section className="border border-border bg-surface px-5 py-5 backdrop-blur md:px-8 md:py-8">
          <div className="grid gap-8 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="flex flex-col justify-between gap-10">
              <div className="flex items-center justify-between gap-4">
                <p className="text-[11px] uppercase tracking-[0.46em] text-muted">Tyrano World</p>
                <p className="text-xs uppercase tracking-[0.26em] text-muted">
                  Anonymous realtime open chat
                </p>
              </div>

              <div className="max-w-4xl">
                <p className="text-xs uppercase tracking-[0.32em] text-muted">
                  For the conversations you cannot post anywhere else
                </p>
                <h1 className="font-display mt-5 text-[56px] leading-[0.88] md:text-[92px] lg:text-[124px]">
                  talk
                  <br />
                  under
                  <br />
                  the table
                </h1>
                <p className="mt-6 max-w-xl text-sm leading-7 text-muted md:text-[15px]">
                  Make a room in seconds. Join with a generated Tyrano nickname. Keep the
                  interface white, dark, or spreadsheet-flat when you need to disappear in
                  plain sight.
                </p>
              </div>

              <div className="grid gap-6 border-t border-border pt-5 md:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted">Now</p>
                  <p className="mt-2 text-lg">{presenceCount} online</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted">Identity</p>
                  <p className="mt-2 text-lg">{effectiveNickname}</p>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted">Status</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{status}</p>
                </div>
              </div>
            </div>

            <div className="grid content-start gap-0 border border-border bg-card">
              <div className="border-b border-border p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Create room</p>
                <input
                  value={draftRoomTitle}
                  onChange={(event) => setDraftRoomTitle(event.target.value)}
                  placeholder="Tyrano lounge"
                  className="mt-4 w-full border border-border bg-transparent px-4 py-3 outline-none"
                />
                <button
                  type="button"
                  onClick={handleCreateRoom}
                  disabled={!hasSupabase}
                  className="mt-3 w-full bg-accent px-4 py-3 text-sm font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Create room
                </button>
              </div>

              <div className="border-b border-border p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Nickname</p>
                <input
                  value={nicknameInput}
                  onChange={(event) => setNicknameInput(event.target.value)}
                  placeholder={effectiveNickname}
                  className="mt-4 w-full border border-border bg-transparent px-4 py-3 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveNickname}
                  className="mt-3 w-full border border-border px-4 py-3 text-sm"
                >
                  Save nickname
                </button>
              </div>

              <div className="p-5">
                <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Theme</p>
                <div className="mt-4 grid grid-cols-3 gap-px bg-border">
                  {(Object.keys(THEME_LABELS) as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTheme(mode)}
                      className={clsx(
                        "bg-card px-3 py-3 text-sm transition",
                        theme === mode && "bg-accent text-[var(--background)]"
                      )}
                    >
                      {THEME_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border border-border bg-surface">
            <div className="border-b border-border px-5 py-4">
              <p className="text-[11px] uppercase tracking-[0.28em] text-muted">Room archive</p>
              <h2 className="font-display mt-3 text-4xl leading-none">rooms</h2>
            </div>

            <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
              {rooms.length === 0 ? (
                <div className="px-5 py-6 text-sm leading-7 text-muted">
                  No rooms yet. Start the first one.
                </div>
              ) : (
                rooms.map((room) => (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setActiveRoomId(room.id)}
                    className={clsx(
                      "w-full border-b border-border px-5 py-5 text-left transition",
                      room.id === activeRoomId ? "bg-card" : "hover:bg-card/70"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base">{room.title}</p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-muted">
                          Open thread
                        </p>
                      </div>
                      <span className="text-xs text-muted">
                        {new Date(room.created_at).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex min-h-0 flex-col border border-border bg-surface">
            <header className="border-b border-border px-5 py-4 md:px-7 md:py-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-muted">Current room</p>
                  <h2 className="font-display mt-3 text-4xl leading-none md:text-6xl">
                    {activeRoom?.title ?? "Select a room"}
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted">
                  <span className="border border-border px-3 py-2">Nickname {effectiveNickname}</span>
                  <span className="border border-border px-3 py-2">Theme {THEME_LABELS[theme]}</span>
                </div>
              </div>
            </header>

            <div
              className={clsx(
                "scrollbar-subtle flex-1 overflow-y-auto",
                theme === "excel" && "bg-grid bg-[size:56px_56px]"
              )}
            >
              <div className="mx-auto flex w-full max-w-5xl flex-col px-5 py-4 md:px-7 md:py-6">
                {messages.length === 0 ? (
                  <div className="border border-dashed border-border px-6 py-12 text-center text-sm leading-7 text-muted">
                    No messages yet. Start with one line.
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <article
                      key={message.id}
                      className={clsx(
                        "border-b border-border py-5",
                        theme === "excel" && "border-0 py-0"
                      )}
                    >
                      {theme === "excel" ? (
                        <div className="grid grid-cols-[72px_1.2fr_2fr_96px] border border-[#c9d7c8] bg-white text-sm">
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
                          <div className="border-r border-[#c9d7c8] px-3 py-3 text-muted">
                            {index + 1}
                          </div>
                          <div className="border-r border-[#c9d7c8] px-3 py-3 font-medium">
                            {message.sender_name}
                          </div>
                          <div className="border-r border-[#c9d7c8] px-3 py-3">
                            {message.content}
                          </div>
                          <div className="px-3 py-3 text-right text-muted">
                            {formatTime(message.created_at)}
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 md:grid-cols-[170px_minmax(0,1fr)_72px] md:items-start">
                          <p className="text-[11px] uppercase tracking-[0.28em] text-muted">
                            {message.sender_name}
                          </p>
                          <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground">
                            {message.content}
                          </p>
                          <time className="text-right text-xs text-muted">
                            {formatTime(message.created_at)}
                          </time>
                        </div>
                      )}
                    </article>
                  ))
                )}
                <div ref={messageEndRef} />
              </div>
            </div>

            <footer className="border-t border-border px-5 py-4 md:px-7 md:py-5">
              <div className="mx-auto flex max-w-5xl flex-col gap-3 md:flex-row">
                <textarea
                  value={draftMessage}
                  onChange={(event) => setDraftMessage(event.target.value)}
                  placeholder={activeRoom ? "Type a message" : "Select or create a room first"}
                  rows={3}
                  disabled={!activeRoom}
                  className="min-h-[88px] flex-1 resize-none border border-border bg-card px-5 py-4 outline-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!activeRoom || !hasSupabase}
                  className="bg-accent px-6 py-4 text-sm font-medium text-[var(--background)] disabled:cursor-not-allowed disabled:opacity-50 md:w-44"
                >
                  Send
                </button>
              </div>
            </footer>
          </section>
        </section>
      </div>
    </main>
  );
}
