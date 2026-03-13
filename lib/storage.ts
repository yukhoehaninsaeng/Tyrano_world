import type { ThemeMode } from "@/types/database";

const KEYS = {
  theme: "tyrano:theme",
  nickname: "tyrano:nickname"
} as const;

export function loadTheme() {
  if (typeof window === "undefined") {
    return "dark" as ThemeMode;
  }

  const value = window.localStorage.getItem(KEYS.theme);
  if (value === "light" || value === "dark" || value === "excel") {
    return value;
  }

  return "dark" as ThemeMode;
}

export function saveTheme(theme: ThemeMode) {
  window.localStorage.setItem(KEYS.theme, theme);
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
