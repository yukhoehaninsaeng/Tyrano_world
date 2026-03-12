const ADJECTIVES = [
  "\ubc30\uace0\ud508",
  "\uc7ac\ube60\ub978",
  "\uc870\uc6a9\ud55c",
  "\uc6a9\uac10\ud55c",
  "\ubc18\uc9dd\uc774\ub294",
  "\ub290\uae0b\ud55c",
  "\uc5c9\ub69d\ud55c",
  "\uae30\ubbfc\ud55c",
  "\ud2bc\ud2bc\ud55c",
  "\ud638\uae30\uc2ec\ub9ce\uc740"
];

export function formatTyranoName(number: number) {
  const adjective = ADJECTIVES[number % ADJECTIVES.length];
  return `${adjective} \ud2f0\ub77c\ub178 ${String(number).padStart(2, "0")}`;
}

export function getAvailableTyranoNumber(occupiedNumbers: number[]) {
  for (let number = 1; number <= 20; number += 1) {
    if (!occupiedNumbers.includes(number)) {
      return number;
    }
  }

  return ((Math.floor(Math.random() * 20) + occupiedNumbers.length) % 20) + 1;
}

export function extractTyranoNumber(name: string) {
  const match = name.match(/(\d{2})$/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (parsed < 1 || parsed > 20) {
    return null;
  }

  return parsed;
}
