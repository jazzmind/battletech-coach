import { NextResponse } from "next/server"
import { applyAction } from "@/lib/game/flow"
import { RuleError } from "@/lib/game/types"
import { getRoom, updateRoom } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = { params: Promise<{ code: string }> }

export async function GET(_request: Request, context: Context) {
  const { code } = await context.params
  const state = await getRoom(code)
  if (!state) return NextResponse.json({ error: "No game with that code." }, { status: 404 })
  return NextResponse.json({ state })
}

export async function POST(request: Request, context: Context) {
  const { code } = await context.params
  const current = await getRoom(code)
  if (!current) return NextResponse.json({ error: "No game with that code." }, { status: 404 })
  let body: { name?: string; playerId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "The coach could not read that." }, { status: 400 })
  }
  const playerId = typeof body.playerId === "string" && body.playerId.length >= 8 ? body.playerId : crypto.randomUUID()
  try {
    const next = applyAction(current, { type: "join", playerId, name: body.name ?? "" })
    if (next === current) return NextResponse.json({ state: current, playerId })
    const saved = await updateRoom(code, current.version, next)
    if (!saved.ok) {
      return NextResponse.json(
        { error: "The table moved. Updating.", state: saved.current },
        { status: 409 },
      )
    }
    return NextResponse.json({ state: next, playerId })
  } catch (error) {
    if (error instanceof RuleError) return NextResponse.json({ error: error.message }, { status: 400 })
    console.error(error)
    return NextResponse.json({ error: "Could not join that game." }, { status: 500 })
  }
}
