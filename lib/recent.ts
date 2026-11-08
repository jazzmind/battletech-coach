export type RecentGame = {
  code: string
  scenarioId: string
  scenario: string
  turn: string
}

const KEY = "mech-coach-recent"

export function remember(list: RecentGame[], next: RecentGame): RecentGame[] {
  return [next, ...list.filter((game) => game.code !== next.code)].slice(0, 8)
}

export function loadRecent(): RecentGame[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as RecentGame[]) : []
    return Array.isArray(parsed) ? parsed.filter((game) => typeof game.code === "string") : []
  } catch {
    return []
  }
}

export function saveRecent(list: RecentGame[]): void {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 8)))
}

export function rememberGame(next: RecentGame): void {
  saveRecent(remember(loadRecent(), next))
}
