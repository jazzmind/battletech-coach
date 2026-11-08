import { present } from "./game/present"
import { scenarioOf } from "./game/scenarios"
import type { Faction, GameState, LogEntry } from "./game/types"

export type RecapMech = {
  name: string
  owner: string
  faction?: Faction
  knockedOut: boolean
  armorLeft?: number
  structureLeft?: number
}

export type Recap = {
  code: string
  scenarioId: string
  title: string
  chapter: string
  finished: string
  players: { id: string; name: string; faction: Faction }[]
  winner: string
  reason: string
  happened: string
  ending: string
  result: "won" | "played" | "draw"
  mechs: RecapMech[]
  log: LogEntry[]
}

const KEY = "mech-coach-recaps"
const LIMIT = 40

export function recapOf(state: GameState, playerId: string): Recap {
  const screen = present(state, playerId)
  const scenario = scenarioOf(state)
  const winner = state.players.find((player) => player.id === state.winnerId)
  const result = !winner ? "draw" : winner.id === playerId ? "won" : "played"
  return {
    code: state.code,
    scenarioId: state.scenarioId,
    title: scenario.title,
    chapter: scenario.chapter,
    finished: new Date().toISOString(),
    players: state.players.map((player) => ({ id: player.id, name: player.name, faction: player.faction })),
    winner: winner?.name ?? "",
    reason: state.winReason ?? "",
    happened: screen.say,
    ending: screen.ending ?? "",
    result,
    mechs: state.mechs.map((mech) => {
      const owner = state.players.find((player) => player.id === mech.ownerId)
      return {
        name: mech.name,
        owner: owner?.name ?? "",
        faction: owner?.faction,
        knockedOut: mech.knockedOut,
        armorLeft: mech.armorLeft,
        structureLeft: mech.structureLeft,
      }
    }),
    log: [...(state.log ?? [])],
  }
}

export function rememberRecap(list: Recap[], next: Recap): Recap[] {
  return [next, ...list.filter((item) => item.code !== next.code)].slice(0, LIMIT)
}

export function forgetRecap(list: Recap[], code: string): Recap[] {
  return list.filter((item) => item.code !== code)
}

export function loadRecaps(): Recap[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Recap[]) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item?.code === "string") : []
  } catch {
    return []
  }
}

export function saveRecaps(list: Recap[]): void {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)))
}

export function saveRecap(next: Recap): void {
  saveRecaps(rememberRecap(loadRecaps(), next))
}

export function deleteRecap(code: string): void {
  saveRecaps(forgetRecap(loadRecaps(), code))
}
