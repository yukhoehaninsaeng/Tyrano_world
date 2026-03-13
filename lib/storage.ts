import type { LayoutMode, ThemeMode } from "@/types/database";

const KEYS = {
  theme: "tyrano:theme",
  layout: "tyrano:layout",
  nickname: "tyrano:nickname",
  joinedRooms: "tyrano:joined-rooms",
  roomPasswords: "tyrano:room-passwords"
} as const;

export function loadTheme() {
  if (typeof window === "undefined") {
    return "dark" as ThemeMode;
  }

  const value = window.localStorage.getItem(KEYS.theme);
  if (value === "light" || value === "dark") {
    return value;
  }

  return "dark" as ThemeMode;
}

export function saveTheme(theme: ThemeMode) {
  window.localStorage.setItem(KEYS.theme, theme);
}

export function loadLayout() {
  if (typeof window === "undefined") {
    return "default" as LayoutMode;
  }

  const value = window.localStorage.getItem(KEYS.layout);
  if (value === "default" || value === "excel" || value === "notepad") {
    return value;
  }

  return "default" as LayoutMode;
}

export function saveLayout(layout: LayoutMode) {
  window.localStorage.setItem(KEYS.layout, layout);
}

export function loadNickname() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(KEYS.nickname) ?? "";
}

export function saveNickname(nickname: string) {
  window.localStorage.setItem(KEYS.nickname, nickname);
}

export function loadJoinedRooms() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(KEYS.joinedRooms);
    if (!raw) {
      return [] as string[];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [] as string[];
  }
}

export function saveJoinedRooms(roomIds: string[]) {
  window.localStorage.setItem(KEYS.joinedRooms, JSON.stringify(roomIds));
}

export function loadRoomPasswords() {
  if (typeof window === "undefined") {
    return {} as Record<string, string>;
  }

  try {
    const raw = window.localStorage.getItem(KEYS.roomPasswords);
    if (!raw) {
      return {} as Record<string, string>;
    }
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
          )
        )
      : {};
  } catch {
    return {} as Record<string, string>;
  }
}

export function saveRoomPassword(roomId: string, password: string) {
  const current = loadRoomPasswords();
  current[roomId] = password;
  window.localStorage.setItem(KEYS.roomPasswords, JSON.stringify(current));
}
