import { existsSync } from "node:fs"
import path from "node:path"

export const ROOT = path.join(__dirname, "..")

export function loadEnv() {
  const file = path.join(ROOT, ".env.local")
  if (existsSync(file)) process.loadEnvFile(file)
}

export function apiKey(): string {
  loadEnv()
  const key = process.env.HEYGEN_API_KEY
  if (!key) {
    console.error("HEYGEN_API_KEY is not set. Add it to .env.local (https://platform.heygen.com/api-keys).")
    process.exit(1)
  }
  return key
}

const BASE = "https://api.heygen.com"

export class HeyGenError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// HeyGen returns 429 for its own per-minute cap and for shared Turbo Free capacity.
export async function heygen<T>(route: string, init: RequestInit = {}, attempts = 6): Promise<T> {
  const key = apiKey()
  let wait = 4000
  for (let attempt = 1; ; attempt += 1) {
    const response = await fetch(`${BASE}${route}`, {
      ...init,
      headers: {
        "x-api-key": key,
        ...(init.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
        ...init.headers,
      },
    })
    if (response.ok) return (await response.json()) as T
    const body = (await response.json().catch(() => ({}))) as { error?: { code?: string; message?: string } }
    const retryable = response.status === 429 || response.status >= 500
    if (retryable && attempt < attempts) {
      const after = Number(response.headers.get("retry-after"))
      const delay = Number.isFinite(after) && after > 0 ? after * 1000 : wait
      console.warn(`  HeyGen ${response.status} ${body.error?.code ?? ""}, retrying in ${Math.round(delay / 1000)}s`)
      await sleep(delay)
      wait = Math.min(wait * 2, 60000)
      continue
    }
    throw new HeyGenError(body.error?.message ?? `HeyGen ${response.status}`, response.status, body.error?.code)
  }
}

export async function download(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed ${response.status} for ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

export { sleep }
