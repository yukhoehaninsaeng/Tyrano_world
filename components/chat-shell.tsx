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
    <main className="safe-screen px-4 py-4 text-foreground md:px-6 md:py-6">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-7xl flex-col gap-4 lg:h-[calc(100dvh-3rem)] lg:flex-row">
        <aside className="flex w-full flex-col rounded-[28px] border border-border bg-surface p-4 shadow-soft backdrop-blur lg:max-w-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-muted">Tyrano World</p>
              <h1 className="mt-2 text-3xl font-semibold">Anonymous realtime chat</h1>
              <p className="mt-3 text-sm leading-6 text-muted">
                Create a room fast, join without signup, and keep the layout tuned to the
                moment.
              </p>
            </div>
            <div className="rounded-full border border-border px-3 py-1 text-xs text-muted">
              {THEME_LABELS[theme]}
            </div>
          </div>

          <div className="mt-6 rounded-3xl border border-border bg-card p-4">
            <label className="text-sm font-medium">Create room</label>
            <div className="mt-3 flex gap-2">
              <input
                value={draftRoomTitle}
                onChange={(event) => setDraftRoomTitle(event.target.value)}
                placeholder="Tyrano lounge"
                className="min-w-0 flex-1 rounded-2xl border border-border bg-transparent px-4 py-3 outline-none"
              />
              <button
                type="button"
                onClick={handleCreateRoom}
                disabled={!hasSupabase}
                className="rounded-2xl bg-accent px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm font-medium">Rooms</p>
            <div className="scrollbar-subtle max-h-56 overflow-y-auto pr-1">
              <div className="flex flex-col gap-2">
                {rooms.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
                    No room yet. Create the first one.
                  </div>
                ) : (
                  rooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setActiveRoomId(room.id)}
                      className={clsx(
                        "rounded-2xl border px-4 py-3 text-left transition",
                        room.id === activeRoomId
                          ? "border-accent bg-accent/10"
                          : "border-border bg-card hover:border-accent/40"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{room.title}</span>
                        <span className="text-xs text-muted">
                          {new Date(room.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-auto grid gap-4 pt-4">
            <div className="rounded-3xl border border-border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Settings</p>
                <span className="text-xs text-muted">localStorage</span>
              </div>

              <div className="mt-4">
                <label className="text-xs uppercase tracking-[0.2em] text-muted">Nickname</label>
                <input
                  value={nicknameInput}
                  onChange={(event) => setNicknameInput(event.target.value)}
                  placeholder={effectiveNickname}
                  className="mt-2 w-full rounded-2xl border border-border bg-transparent px-4 py-3 outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveNickname}
                  className="mt-2 w-full rounded-2xl border border-border px-4 py-3 text-sm font-medium"
                >
                  Save nickname
                </button>
              </div>

              <div className="mt-4">
                <label className="text-xs uppercase tracking-[0.2em] text-muted">Theme</label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {(Object.keys(THEME_LABELS) as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setTheme(mode)}
                      className={clsx(
                        "rounded-2xl border px-3 py-3 text-sm",
                        theme === mode ? "border-accent bg-accent/10" : "border-border"
                      )}
                    >
                      {THEME_LABELS[mode]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-4 text-sm text-muted">
              <p>{status}</p>
              <p className="mt-2">Online now: {presenceCount}</p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-1 flex-col rounded-[32px] border border-border bg-surface shadow-soft backdrop-blur">
          <header className="flex flex-col gap-3 border-b border-border px-5 py-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-muted">Open Room</p>
              <h2 className="mt-2 text-2xl font-semibold">
                {activeRoom?.title ?? "Select a room"}
              </h2>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted">
              <span className="rounded-full border border-border px-3 py-2">
                Nickname: {effectiveNickname}
              </span>
              <span className="rounded-full border border-border px-3 py-2">
                Messages: {messages.length}
              </span>
            </div>
          </header>

          <div
            className={clsx(
              "scrollbar-subtle flex-1 overflow-y-auto px-4 py-4 md:px-5",
              theme === "excel" && "bg-grid bg-[size:56px_56px]"
            )}
          >
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
              {messages.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-border bg-card/70 p-8 text-center text-sm text-muted">
                  Leave the first message in this room.
                </div>
              ) : (
                messages.map((message, index) => (
                  <article
                    key={message.id}
                    className={clsx(
                      "rounded-3xl border border-border bg-card/90 p-4",
                      theme === "excel" && "rounded-none bg-white"
                    )}
                  >
                    {theme === "excel" ? (
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
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium">{message.sender_name}</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">
                            {message.content}
                          </p>
                        </div>
                        <time className="shrink-0 text-xs text-muted">
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

          <footer className="border-t border-border px-4 py-4 md:px-5">
            <div className="mx-auto flex max-w-4xl flex-col gap-3 md:flex-row">
              <textarea
                value={draftMessage}
                onChange={(event) => setDraftMessage(event.target.value)}
                placeholder={activeRoom ? "Type a message" : "Select or create a room first"}
                rows={3}
                disabled={!activeRoom}
                className="min-h-[76px] flex-1 resize-none rounded-3xl border border-border bg-card px-4 py-4 outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              <button
                type="button"
                onClick={handleSendMessage}
                disabled={!activeRoom || !hasSupabase}
                className="rounded-3xl bg-accent px-6 py-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 md:w-36"
              >
                Send
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}
