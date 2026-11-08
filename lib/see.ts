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
