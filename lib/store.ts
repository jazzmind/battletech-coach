import type { GameState } from "./game/types"

const TTL_SECONDS = 60 * 60 * 18

type Memory = Map<string, GameState>

const globalStore = globalThis as unknown as { __mechRooms?: Memory }
const memory: Memory = globalStore.__mechRooms ?? new Map()
globalStore.__mechRooms = memory

function redisReady(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  return Boolean(url && token)
}

function roomKey(code: string): string {
  return `room:${code.toUpperCase()}`
}

export async function createRoom(state: GameState): Promise<void> {
  const code = state.code.toUpperCase()
  if (redisReady()) {
    const redis = await client()
    const saved = await redis.set(roomKey(code), state, { nx: true, ex: TTL_SECONDS })
    if (saved !== "OK") throw new Error("That code is already in use.")
    return
  }
  if (memory.has(code)) throw new Error("That code is already in use.")
  memory.set(code, state)
}

export async function getRoom(code: string): Promise<GameState | null> {
  const id = code.toUpperCase()
  if (redisReady()) {
    const redis = await client()
    const value = await redis.get<GameState>(roomKey(id))
    return value ?? null
  }
  return memory.get(id) ?? null
}

export async function updateRoom(
  code: string,
  expectedVersion: number,
  next: GameState,
): Promise<{ ok: true } | { ok: false; current: GameState | null }> {
  const id = code.toUpperCase()
  if (redisReady()) {
    const redis = await client()
    const result = (await redis.eval(
      `local raw = redis.call('GET', KEYS[1])
       if not raw then return 'missing' end
       local decoded = cjson.decode(raw)
       if tonumber(decoded['version']) ~= tonumber(ARGV[1]) then return 'conflict' end
       redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
       return 'ok'`,
      [roomKey(id)],
      [String(expectedVersion), JSON.stringify(next), String(TTL_SECONDS)],
    )) as string
    if (result === "ok") return { ok: true }
    return { ok: false, current: await getRoom(id) }
  }
  const current = memory.get(id) ?? null
  if (!current || current.version !== expectedVersion) return { ok: false, current }
  memory.set(id, next)
  return { ok: true }
}

async function client() {
  const { Redis } = await import("@upstash/redis")
  return Redis.fromEnv()
}
