import { toNextJsHandler } from "better-auth/next-js"
import { NextResponse } from "next/server"
import { authConfigured, getAuth } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handle(request: Request) {
  if (!authConfigured()) {
    return NextResponse.json({ error: "Sign-in is not set up on this server." }, { status: 503 })
  }
  const { GET, POST } = toNextJsHandler(getAuth())
  if (request.method === "GET") return GET(request)
  if (request.method === "POST") return POST(request)
  return NextResponse.json({ error: "That sign-in request is not supported." }, { status: 405 })
}

export { handle as GET, handle as POST }
