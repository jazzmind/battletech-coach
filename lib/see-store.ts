import { decideSee, type SeeFlag } from "./see"

const DAY_SECONDS = 60 * 60 * 24
const LAST_SECONDS = 60

type MemoryBucket = { day: number; flag: SeeFlag; last: number | null }

const globalBuckets = globalThis as unknown as { __seeBuckets?: Map<string, MemoryBucket> }
const memory: Map<string, MemoryBucket> = globalBuckets.__seeBuckets ?? new Map()
globalBuckets.__seeBuckets = memory

function redisReady(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  return Boolean(url && token)
}

export async function chargeLook(userId: string) {
  if (redisReady()) return chargeRedis(userId)
  return chargeMemory(userId)
}

function chargeMemory(userId: string) {
  const bucket = memory.get(userId) ?? { day: 0, flag: null, last: null }
  const since = bucket.last == null ? null : Date.now() - bucket.last
  if (bucket.flag === "blocked") return { ...decideSee({ flag: "blocked", dayCount: bucket.day, sinceLastMs: since }), burst: false }
  if (since != null && since < 8_000) return { ...decideSee({ flag: bucket.flag, dayCount: bucket.day, sinceLastMs: since }), burst: true }
  bucket.day += 1
  bucket.last = Date.now()
  const decision = decideSee({ flag: bucket.flag, dayCount: bucket.day, sinceLastMs: since })
  noteFlag(userId, bucket.flag, decision.flag, bucket.day)
  bucket.flag = decision.flag
  memory.set(userId, bucket)
  return { ...decision, burst: false }
}

async function chargeRedis(userId: string) {
  const redis = await client()
  const flagKey = `see:flag:${userId}`
  const dayKey = `see:day:${userId}`
  const lastKey = `see:last:${userId}`
  const flag = (await redis.get<SeeFlag>(flagKey)) ?? null
  const lastRaw = await redis.get<string>(lastKey)
  const last = lastRaw == null ? null : Number(lastRaw)
  const since = last == null || Number.isNaN(last) ? null : Date.now() - last
  const day = (await redis.get<number>(dayKey)) ?? 0
  if (flag === "blocked") return { ...decideSee({ flag, dayCount: day, sinceLastMs: since }), burst: false }
  if (since != null && since < 8_000) return { ...decideSee({ flag, dayCount: day, sinceLastMs: since }), burst: true }
  const next = await redis.incr(dayKey)
  if (next === 1) await redis.expire(dayKey, DAY_SECONDS)
  await redis.set(lastKey, String(Date.now()), { ex: LAST_SECONDS })
  const decision = decideSee({ flag, dayCount: next, sinceLastMs: since })
  noteFlag(userId, flag, decision.flag, next)
  if (decision.flag) await redis.set(flagKey, decision.flag)
  return { ...decision, burst: false }
}

function noteFlag(userId: string, before: SeeFlag, after: SeeFlag, day: number) {
  if (before === after) return
  if (after === "watch") console.warn(`see watch ${userId} day=${day}`)
  if (after === "blocked") console.warn(`see blocked ${userId} day=${day}`)
}

async function client() {
  const { Redis } = await import("@upstash/redis")
  return Redis.fromEnv()
}
