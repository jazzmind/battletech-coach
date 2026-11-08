export type SeeFlag = "watch" | "blocked" | null

const BURST_MS = 8_000
const WATCH_AT = 80
const BLOCK_AT = 200

export function decideSee(input: {
  flag: SeeFlag
  dayCount: number
  sinceLastMs: number | null
}): { result: "allow" | "watch" | "block"; flag: SeeFlag } {
  if (input.flag === "blocked") return { result: "block", flag: "blocked" }
  if (input.sinceLastMs != null && input.sinceLastMs < BURST_MS) return { result: "block", flag: input.flag }
  if (input.dayCount >= BLOCK_AT) return { result: "block", flag: "blocked" }
  if (input.dayCount >= WATCH_AT) return { result: "watch", flag: "watch" }
  return { result: "allow", flag: input.flag }
}

export const SEE_LIMITS = { burstMs: BURST_MS, watchAt: WATCH_AT, blockAt: BLOCK_AT }

function joinNames(names: string[]): string {
  const labeled = names.map((name) => `the ${name}`)
  if (labeled.length <= 1) return labeled[0] ?? ""
  if (labeled.length === 2) return `${labeled[0]} and ${labeled[1]}`
  return `${labeled.slice(0, -1).join(", ")}, and ${labeled[labeled.length - 1]}`
}

export function describeSeen(names: string[], scores: number[]): string {
  const seen: string[] = []
  const missing: string[] = []
  names.forEach((name, index) => ((scores[index] ?? 0) >= 0.6 ? seen : missing).push(name))
  const parts: string[] = []
  if (seen.length > 0) parts.push(`I can see ${joinNames(seen)}.`)
  if (missing.length > 0) parts.push(`I can't find ${joinNames(missing)}.`)
  if (parts.length === 0) return "I can't tell from here."
  return parts.join(" ")
}
