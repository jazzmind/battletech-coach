import { betterAuth, type BetterAuthOptions } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { magicLink } from "better-auth/plugins/magic-link"
import { passkey } from "@better-auth/passkey"
import { Pool } from "pg"

export function authConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET)
}

export function authOptions(secret: string, databaseUrl: string): BetterAuthOptions {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN
  return {
    secret,
    baseURL: process.env.BETTER_AUTH_URL || undefined,
    database: new Pool({ connectionString: databaseUrl }),
    emailAndPassword: { enabled: false },
    session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },
    secondaryStorage: url && token ? redisStorage() : undefined,
    rateLimit: url && token ? { enabled: true, storage: "secondary-storage" } : undefined,
    plugins: [
      magicLink({
        disableSignUp: false,
        sendMagicLink: async ({ email, url: link }) => {
          await sendLink(email, link)
        },
      }),
      passkey({
        rpID: process.env.PASSKEY_RP_ID || "localhost",
        rpName: "Table Coach",
        origin: process.env.BETTER_AUTH_URL?.replace(/\/$/, "") || "http://localhost:3000",
      }),
      nextCookies(),
    ],
  }
}

function buildAuth(secret: string, databaseUrl: string) {
  return betterAuth(authOptions(secret, databaseUrl))
}

let cached: ReturnType<typeof buildAuth> | null = null

export function getAuth() {
  if (cached) return cached
  const secret = process.env.BETTER_AUTH_SECRET
  const databaseUrl = process.env.DATABASE_URL
  if (!secret || !databaseUrl) throw new Error("Sign-in is not set up on this server.")
  cached = buildAuth(secret, databaseUrl)
  return cached
}

async function sendLink(email: string, link: string) {
  const key = process.env.RESEND_API_KEY
  const from = process.env.AUTH_FROM
  if (!key || !from) throw new Error("Email sign-in is not set up on this server.")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "Your Table Coach link",
      text: `Tap this link to sign in. It works once, for a few minutes.\n\n${link}`,
    }),
  })
  if (!response.ok) {
    const detail = await response.text()
    throw new Error(detail || "The sign-in email did not send.")
  }
}

function redisStorage() {
  return {
    async get(key: string) {
      const redis = await client()
      const value = await redis.get<string>(key)
      return value ?? null
    },
    async getAndDelete(key: string) {
      const redis = await client()
      const value = await redis.get<string>(key)
      if (value != null) await redis.del(key)
      return value ?? null
    },
    async increment(key: string, ttl: number) {
      const redis = await client()
      const value = await redis.incr(key)
      if (value === 1) await redis.expire(key, ttl)
      return value
    },
    async set(key: string, value: string, ttl?: number) {
      const redis = await client()
      if (ttl) await redis.set(key, value, { ex: ttl })
      else await redis.set(key, value)
    },
    async delete(key: string) {
      const redis = await client()
      await redis.del(key)
    },
  }
}

async function client() {
  const { Redis } = await import("@upstash/redis")
  return Redis.fromEnv()
}
